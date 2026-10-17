# Liaison des collections Decap au site ATR — préparation locale

État vérifié le 17 octobre 2026. Branche locale : `codex/cms-content-integration`, fondée sur `origin/main` au commit `384d060`.
Aucun commit, push, changement d’autorisation ou déploiement n’a été effectué.

## Cause et diagnostic des six collections

| Collection | Stockage | Avant correction | Préparation réalisée |
| --- | --- | --- | --- |
| Événements | `content/events/*.fr.json` | Huit fiches écrites dans `index.html`, aucun chargement CMS | Catalogue, articles avec dates et statut calculé, lieu, résumé, détail, objectifs, programme, image facultative et PDF |
| Aventures des membres | `content/member-adventures/*.fr.json` | J E E Y est écrit dans la page, avec son formulaire et son expiration | Nouvelles aventures CMS affichées avec organisateur, mention du rôle ATR, itinéraire, galerie et roadbook ; expiration à minuit Dakar après le dernier jour |
| ATR TV | `content/atr-tv/*.fr.json` | Déjà relié à son catalogue et à son lecteur | Mécanisme préservé, tests existants réexécutés |
| Actualités moto | `content/moto-news/*.fr.json` | Collection disponible mais aucun affichage | Articles, catégories, source et lien HTTPS ; archivage ajouté au CMS ; actualités futures masquées ; bandeau de cinq titres maximum |
| Bannières | `content/partner-banners/*.fr.json` | Aucun emplacement public relié | Quatre emplacements, dates Dakar inclusives, actif/inactif, archivage, priorité, rotation par bouton accessible et mention Publicité ; emplacements vides masqués |
| Ride & Give | `content/ride-and-give/*.fr.json` | Présentation écrite directement dans la page | Nouvelles actions affichées avec dates, lieux, récit, images et PDF, sans remplacer la présentation existante |

Le fichier Nianing publié sur main existe et a été lu via l’API GitHub. Il contient une date simple `2026-10-17` et `2026-10-18`, une localisation `Nianing`, un titre accentué, un résumé et un corps Markdown. Il ne contient pas de programme, d’objectifs ou de média. Ces champs de liste deviennent facultatifs dans le formulaire événement : aucune information n’a été inventée pour les remplir.

L’ancien générateur ne produisait qu’`atr-tv-catalog.json`. Aucun script ne découvrait les événements ni les quatre autres collections. Les nouveaux fichiers JSON pouvaient donc être présents dans le dépôt et dans un déploiement réussi sans produire de fiche publique.

## Langue et conservation des publications récentes

La copie locale initiale précédait six commits de main. La comparaison a révélé un passage volontaire au français uniquement. L’intégration a été reportée sur la version actuelle, sans rétablir le sélecteur FR/EN ni modifier le lecteur, `script.js` ou `translations.js`.

`admin/config.yml` conserve `locales: [fr]`, le format `multiple_files` et tous les fichiers anglais historiques. Les catalogues gardent leur compatibilité avec les traductions existantes et le repli français. Les champs partagés viennent du français ; une ancienne copie anglaise ne bloque pas une édition française. Aucune traduction externe ni traduction inventée n’a été ajoutée.

## Construction et affichage

1. Le contributeur prépare son contenu dans Decap, sur son fork si nécessaire.
2. Le propriétaire examine la PR et décide de la fusion sur main.
3. Le workflow existant exécute les tests puis `node scripts/build-atr-tv.mjs --site-dir _site`.
4. Le générateur TV conserve son catalogue et appelle le générateur des cinq autres collections.
5. `_site/cms-content-catalog.json` contient les entrées françaises autorisées avec leurs traductions disponibles. Les noms de fichiers accentués sont acceptés.
6. `cms-content.js` charge ce catalogue, génère des éléments DOM et réutilise la mise en page des événements. Le HTML brut n’est jamais interprété. Le Markdown pris en charge comprend paragraphes, titres, listes simples, gras et liens HTTPS.
7. Les archivés et l’événement intitulé « TEST INTERNE ATR — NE PAS PUBLIER » sont exclus du catalogue. Les doublons CMS de titre, dates, lieu et emplacement identiques bloquent la construction au lieu de produire deux fiches. Les versions FR/EN sont regroupées par nom de fichier.
8. Les aventures expirent après le dernier jour ; les bannières et les actualités suivent leurs dates. Les pages laissées ouvertes sont recalculées au changement de jour Dakar et au retour sur la page.

Les huit fiches historiques ne sont ni supprimées ni converties en contenus CMS. Sur instruction explicite du propriétaire, le programme proposé de Nianing (16–18 octobre, PDF conservé) et l’article CMS (17–18 octobre) restent distincts. L’article est identifié comme tel. Les dates et les textes n’ont pas été harmonisés par supposition.

## Artefact public

Le répertoire généré est recréé à chaque construction pour empêcher qu’un ancien fichier reste publié. La suppression est limitée aux dossiers de génération `_site` ou `_site-<nom>` à la racine du projet ; les dossiers sources sont refusés.

Sont copiés : page d’accueil, CSS, scripts publics, utilitaires, interface Decap, `CNAME`, robots, sitemap et médias suivis par Git dans `images/`, `documents/`, `uploads/`. Deux catalogues et `.nojekyll` sont générés à la racine de l’artefact.

Les sources `content/` n’ont pas besoin d’être publiées comme fichiers HTTP : Decap y accède via GitHub. Elles restent intégralement dans Git. Les JSON archivés et le test interdit ne sont pas copiés dans l’artefact. Les médias ne sont pas supprimés pour autant : un PDF ou une image archivée peut conserver une URL publique. L’archivage n’est pas un mécanisme de confidentialité.

Sont exclus : `.git`, fichiers système, `auth-worker/`, scripts de construction, tests, documentation, fichiers non suivis et paramètres internes. Aucun secret n’a été ajouté. Le dépôt et les forks publics restent consultables : ne pas y saisir de propositions confidentielles ou de données personnelles issues de Formspree.

## Inventaire avant migration importante — migration non exécutée

| Contenu existant | Source actuelle | Traitement proposé après validation |
| --- | --- | --- |
| Camp ATR, 17–19 avril 2026, Lac Rose | Fiche événement HTML | Fichier événement conservant exactement son texte |
| Atelier de secourisme, 18 avril 2026, Lac Rose | Fiche événement HTML | Fichier distinct, lien éditorial vers le camp sans suppression |
| Action environnementale, 21 juin 2026, Pépinière de Bambilor | Fiche événement HTML | Conservation du texte, des 1 000 badamiers et du rôle de Quartier Vert Challenge |
| RIDE AND GIVE, 28 juin 2026, Saint-Louis | Fiche événement et présentation solidaire | Liaison éditoriale explicite, sans confondre les deux emplacements |
| Don de sang ATR, 19 septembre 2026, CNTS | Fiche événement HTML | Conservation du texte et de la collaboration DBB |
| Programme proposé du 2e camp, 16–18 octobre 2026, Nianing | Fiche HTML avec quatre objectifs, trois journées et PDF | Fichier événement programme ; préserver les horaires proposés et l’avertissement, conserver le PDF et distinguer l’article publié |
| ATR Safety Day | Fiche HTML sans date ni lieu confirmés | Étendre d’abord le schéma pour accepter une date et un lieu inconnus, sans valeur factice |
| Grande Expédition ATR | Fiche HTML sans date ni destination confirmées | Même traitement, sans inventer de destination |
| Aventure J E E Y | HTML, photo, roadbook, ancrages, formulaire Formspree | Préparer un schéma préservant toutes les informations, les identifiants et le formulaire avant de remplacer la fiche |
| Présentation Ride & Give | HTML | Distinguer l’introduction structurelle des actions administrables ; décision du propriétaire avant migration |

La gestion des **nouvelles publications** des six collections est reliée au site. L’administration complète des anciens contenus codés en HTML nécessite cette migration distincte, à valider sur l’inventaire ci-dessus. Elle n’est pas annoncée comme terminée.

## Droits et limites de l’approbation

Lectures GitHub réalisées sans modification :

- Le seul collaborateur disposant de droits d’écriture retourné par l’API est `malangbabou2-netizen`, administrateur.
- Pour `Sultanatr221`, GitHub retourne `permission: read`, `push: false`, `admin: false` ; il ne peut pas publier sur le dépôt officiel par cette permission.
- Open Authoring et `editorial_workflow` restent activés. Les contributeurs sans droit d’écriture travaillent via fork et PR ; le statut Decap n’est pas, à lui seul, une barrière de sécurité.
- Main exige un parcours par PR mais `required_approving_review_count` vaut 0, l’approbation CODEOWNERS n’est pas exigée, et `enforce_admins` est désactivé. Aucun ruleset supplémentaire n’a été retourné.
- La séparation actuelle repose donc sur l’absence de droit d’écriture du contributeur et sur la fusion par le propriétaire, pas sur une approbation nominative obligatoire configurée dans GitHub.
- Ne pas accorder Write/Maintain/Admin au gestionnaire. Avant toute évolution de ces droits, proposer une protection adaptée et obtenir la validation du propriétaire. Une règle d’approbation ou CODEOWNERS pourrait renforcer le contrôle ; ne pas l’activer sans vérifier les conséquences pour les propres PR du propriétaire.
- Le Worker local contrôle une liste de logins GitHub après interrogation de l’identité GitHub. Sa version déployée, la liste Production et une session réelle de Sultan n’ont pas été vérifiées ; aucune configuration OAuth n’a été lue ou modifiée. La liste autorisée donne accès au CMS, elle ne confère pas de droit de fusion sur GitHub.

Références : [Open Authoring Decap](https://decapcms.org/docs/open-authoring/) et [protections de branche GitHub](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/managing-a-branch-protection-rule).

## Contrôles et limites des tests

- Tests unitaires TV et CMS : création locale, modification, repli, archivage, dates, tri, doublons, URL sûres, publication main uniquement, contenu réel Nianing et intégrité de l’artefact.
- Navigateur Chrome réel, ordinateur 1440 et mobile simulé 390/320 pixels : article, détails, dates, huit fiches historiques, absence de débordement, PDF HTTP 200 avec signature PDF, image absente retirée, formulaires conservés et ATR TV présent.
- Cinq nouvelles collections testées avec des données interceptées uniquement dans le navigateur ; aucun de ces exemples n’est écrit dans `content/` ou publié.
- Bannières : actif, plage de dates, priorité, bouton de rotation et masque lorsque vide ; actualités : sources, catégorie et limite de cinq titres ; aventures : expiration et mentions.
- Tests navigateur TV existants : filtres, tri, archivage, minimum de 200 px du lecteur mobile, menus, états chargement/vide/erreur et fermeture du lecteur.
- Bascule Hero testée à `2026-11-01T00:00:00Z`, avec horloge du navigateur contrôlée et fuseau navigateur America/New_York : image initiale et boutons restaurés.
- YAML analysé localement ; aucun changement du backend OAuth, de la destination éditoriale ou des formulaires.

Les tests de génération simulent un contenu déjà approuvé dans les sources. Ils **ne prouvent pas** la connexion OAuth, l’enregistrement d’un vrai brouillon distant, la revue par un second compte ou une publication Decap réelle. Ces contrôles nécessitent une recette propriétaire/contributeur séparée, sur un environnement isolé et autorisé, sans publier d’article de test dans le site officiel. Safari et les téléphones physiques n’ont pas été testés pendant cette intervention. Le Markdown complexe (tableaux, HTML, extensions) n’est pas interprété par ce rendu volontairement limité.

Les images facultatives manquantes sont retirées de l’affichage ; cela ne remplace pas la vérification des droits sur les images. Les nouvelles pièces jointes doivent être suivies par Git et incluses dans la PR. La construction ne crée aucun compte, n’envoie aucun formulaire et ne publie pas une proposition Formspree.

## Validation et publication — opérations non exécutées

1. Ouvrir l’aperçu local `_site` via HTTP et examiner les captures de tests.
2. Valider le diff des seuls fichiers de cette intégration ; exclure les fichiers personnels non suivis.
3. Après autorisation, créer un commit sur la branche dédiée puis une PR vers main. Aucun catalogue généré ni dossier `_site` n’est à ajouter à Git.
4. Attendre les tests GitHub Actions. Examiner le catalogue de l’artefact, les médias, le PDF, les formulaires et la séparation programme/article Nianing.
5. Le propriétaire décide de la fusion. La configuration Pages est déjà de type `workflow` ; ne pas réactiver un déploiement Jekyll concurrent depuis la branche.
6. Après déploiement autorisé : vérifier `/cms-content-catalog.json` et `/atr-tv-catalog.json` (HTTP 200), `/#evenements`, ATR TV, `/admin/`, les PDF et le comportement mobile.
7. Retour arrière : préparer une PR annulant le commit d’intégration, puis la faire valider et déployer par le même parcours. Ne pas effacer les contenus CMS ni les médias ; ne pas forcer l’historique.

## Fichiers de cette préparation

Modifiés : `index.html`, `style.css`, `admin/config.yml`, `scripts/build-atr-tv.mjs`, `.github/workflows/atr-pages.yml`, `.gitignore`.

Créés : `cms-content.js`, `cms-content-utils.mjs`, `scripts/build-cms-content.mjs`, `tests/cms-content.test.mjs`, `tests/cms-content.browser.cjs`, `docs/CMS-CONTENT-INTEGRATION.md`.

`script.js`, `translations.js`, `atr-tv.js`, le Worker OAuth, les contenus CMS déjà publiés, les images et les PDF ne sont pas modifiés par cette intégration. Les fichiers personnels non suivis présents au départ restent présents et ne sont pas ajoutés à Git.

Résultats obtenus : 26 tests unitaires/artefact réussis ; tests navigateur CMS et TV réussis. L’audit existant de lecture réelle YouTube a également réussi dans ses quatre variantes (1440, cookies tiers bloqués, 390 et 320 pixels), avec lecture à partir de 674 secondes, sans erreur 153 et lecteur mobile de 200 pixels minimum. L’origine HTTPS officielle est simulée localement par interception du navigateur : ce contrôle ne constitue pas un déploiement ou une préproduction hébergée. Les captures locales sont dans `/private/tmp/atr-cms-preview/` et `/private/tmp/atr-tv-preview/`.
