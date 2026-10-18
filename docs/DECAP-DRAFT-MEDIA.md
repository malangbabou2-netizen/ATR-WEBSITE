# Correctif local des aperçus de médias Decap

## Portée

Branche de préparation : `codex/decap-draft-media-preview`, fondée sur main `59fe70f`.
Le changement concerne exclusivement l’administration. Aucun contenu ATR, média existant, formulaire, code du Hero ou réglage OAuth n’est modifié. `admin/config.yml` conserve `media_folder: uploads`, `public_folder: /uploads`, Open Authoring et `editorial_workflow`.

## Cause confirmée dans le fichier réellement chargé

L’administration chargeait `https://cdn.jsdelivr.net/npm/decap-cms@3.16.3/dist/decap-cms.js`.
Le SHA-256 du fichier téléchargé est :

`7c1efd6b616b4786e279aeef194dd21649a72058d3bc8d1f78901b574610dfb8`

La source map de ce fichier contient `decap-cms-core/dist/esm/actions/media.js`. La fonction `getAsset`, nommée `Wc` dans ce bundle précis, recherche `/uploads/image.png` dans le cache alors que le média du brouillon est enregistré sous `uploads/image.png`. Son repli vers l’adresse publique déclenche donc un 404 avant publication. Le test navigateur reproduit ce 404 avec le bundle original reconstitué, puis teste la même interface avec le correctif.

Référence amont : https://github.com/decaporg/decap-cms/issues/7639

## Correction

`getAsset` consulte d’abord l’AssetProxy déjà présent en mémoire sous le chemin du média du brouillon. Le chemin est calculé par les sélecteurs Decap existants, en tenant compte de la collection et du champ. Le proxy n’est utilisé que si la conversion inverse vers le chemin public redonne exactement la valeur demandée. Cela exclut les URL externes et les autres répertoires.

Le correctif précède aussi le cache public : une ancienne résolution en 404 ne masque plus un import récent. Sans média correspondant en mémoire, le comportement amont est conservé. Aucun fichier n’est publié, déplacé ou renommé, et les valeurs JSON restent `/uploads/...`.

Le bundle est servi localement sous `admin/vendor/decap-cms-3.16.3-atr.1.js`. `admin/index.html` le référence avec une empreinte SRI SHA-384. Le fichier reste celui de Decap 3.16.3 (environ 5,2 Mo non compressés), avec une seule insertion fonctionnelle. La référence à la source map amont est retirée puisqu’elle ne correspondrait plus au fichier corrigé. Les licences Decap et celles des dépendances sont conservées dans le même dossier.

Il ne s’agit pas d’un remplacement général de chaînes dans le navigateur : la copie corrigée est préparée à l’avance, et le script refuse tout fichier dont l’empreinte ou le point d’insertion diffère. Aucun patch n’est téléchargé ou appliqué dynamiquement en production.

## Reproduction hors ligne du bundle corrigé

Télécharger séparément le fichier original de la version 3.16.3 depuis l’URL ci-dessus, puis exécuter :

```sh
node scripts/prepare-decap-media.mjs --source /chemin/vers/decap-cms.js
```

Le script n’accède pas au réseau. Il vérifie l’empreinte amont, applique le correctif unique et affiche les empreintes du résultat. Le résultat attendu est :

- SHA-256 : `7145f17d541776d1eac7976a7d618a0e5ca89737326ebaeaac982529f7f2af91`
- SRI : `sha384-mfDybMq4OKFTV++CiLzoKi8RtOb/caaGvm+O1h9wqxecu3/lR4YdDPzhzoBtzqc8`

Les licences fournies avec le bundle sont incluses. Pour une mise à jour Decap, relire les fonctions et leurs sélecteurs, renouveler explicitement le nom du fichier et les empreintes, puis exécuter les tests. Ne pas adapter aveuglément les noms minifiés ni désactiver les vérifications. Si une version stable amont corrige ce parcours, privilégier son adoption après recette et supprimer ce correctif local.

## Tests

```sh
node --test tests/atr-tv.test.mjs tests/cms-content.test.mjs tests/hero-carousel.test.mjs tests/decap-media.test.mjs
node tests/decap-media.browser.cjs
node scripts/build-atr-tv.mjs --site-dir _site
```

Les tests navigateur nécessitent Playwright et Chrome, comme les autres tests navigateur du projet. Ils chargent le véritable script Decap, avec la véritable configuration des collections ; seul le backend est remplacé dans la réponse interceptée par le backend officiel `test-repo` avec connexion simulée. La configuration du projet n’est pas réécrite. Les requêtes vers tout autre hôte sont bloquées.

La recette compare le script d’origine et le script corrigé : bibliothèque de médias, image principale, image mobile, état brouillon, sauvegarde simulée, réouverture et rechargement du document sans réutiliser le cache de médias. Le stockage simulé du brouillon est reconstruit avec de nouveaux fichiers et URL temporaires. Une image déjà publiée reste accessible ; l’import d’un remplacement ne modifie pas sa version publiée.

Les tests unitaires vérifient également : empreinte et reproductibilité du bundle, rejet d’une autre version, conservation des URL publiques/externes, noms Unicode, chemins spécifiques aux champs, cache public précédemment erroné, intégrité SRI et présence du script et des licences dans l’artefact Pages. Le workflow existant ajoute ce test à sa commande de validation, sans changement des droits ou des conditions de déploiement.

Résultat de la préparation locale : 42 tests automatisés réussis, dont 8 consacrés au correctif. Les cinq suites navigateur (Decap, collections CMS, Hero, ATR TV et lecture YouTube) ont réussi. La génération `_site` inclut le bundle et ses licences avec les octets et l’intégrité attendus. Les aperçus Decap ont été vérifiés à 1280 et 390 pixels. Aucun contrôle GitHub Actions distant n’a été déclenché : la branche n’a pas été poussée.

La recette utilise uniquement des images de test et un stockage local au navigateur. Elle ne se connecte pas à GitHub et n’enregistre aucun vrai brouillon dans le dépôt. Une recette avec les comptes GitHub réels reste à autoriser séparément ; Safari et les téléphones physiques ne sont pas couverts par les tests Chrome.

Observation indépendante : dans cette recette, une nouvelle fiche partenaire reçoit un nom de fichier très long, généré à partir de ses données. La sauvegarde et la réouverture réussissent. La politique de nommage des fiches est à examiner séparément ; elle n’est pas modifiée par ce correctif d’aperçu.

## Confidentialité et approbation

Avant enregistrement, l’aperçu repose sur un Blob local au navigateur. Après enregistrement dans GitHub, le circuit éditorial habituel s’applique ; le correctif ne fusionne et ne publie rien.

Important : les branches et forks d’un dépôt GitHub public ne constituent pas un stockage confidentiel. Le correctif empêche l’affichage prématuré sur le site officiel, mais ne peut pas rendre privés les médias qu’un utilisateur décide d’enregistrer sur une branche publique. Garantir une confidentialité complète nécessiterait une architecture de stockage distincte, hors de cette correction et à approuver séparément.

## Validation et retour arrière

Les nouveaux fichiers sous `admin/vendor/` doivent être suivis par Git : le générateur ne copie pas les fichiers personnels non suivis. Aucun secret ni contenu de brouillon réel n’est présent dans ce dossier. Le bundle est destiné à être publié, contrairement aux dossiers temporaires des tests.

Relire la branche puis effectuer les étapes de commit, PR, fusion et publication uniquement après autorisation. Ne pas lancer de workflow de déploiement manuel pendant cette préparation. Le retour arrière consiste à rétablir la référence CDN précédente dans `admin/index.html` et à retirer le correctif et ses fichiers via une modification revue ; les contenus et leurs chemins restent compatibles.
