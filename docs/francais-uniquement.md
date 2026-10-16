# Passage au français uniquement

## Portée et dépendances

- `index.html` : retrait du sélecteur FR/EN et version des scripts renouvelée pour éviter un ancien code anglais en cache ; le contenu français, les liens et les formulaires restent en place.
- `script.js` : retrait du remplacement de texte anglais ; menu et statuts des aventures en français ; ancienne préférence `atr-language=en` remplacée par `fr`, sans dépendre de la disponibilité du stockage.
- `translations.js` : dictionnaires historiques conservés intégralement ; aucun code public ne sélectionne plus leurs valeurs anglaises.
- `atr-tv.js` : libellés et textes français du catalogue uniquement. Filtres, tri, archives, mise en avant, miniatures, lecteur, lien externe et fermeture conservés.
- `atr-tv-utils.mjs` : inchangé ; identifiants des cinq catégories, validation des URL YouTube, paramètres de lecture et contrôles des images conservés.
- `admin/config.yml` : `locale: fr` déjà présent ; seule la liste des langues éditables devient `[fr]`. Les six collections et tous leurs champs restent identiques.
- `scripts/build-atr-tv.mjs` : le français devient la référence des champs partagés. Une ancienne copie anglaise ne bloque plus une modification française. Le catalogue version 1 et ses traductions restent compatibles.
- Tests unitaires et navigateur adaptés ; audit de lecture réelle conservé sans modification. Le workflow de validation ne change que le nom de son étape de génération.

Les noms officiels et libellés métier existants (Africa Twin Riders, ATR TV, Ride & Give, ATR Safety Day, Road Trips, Off-Road) sont conservés.

## Migration sans perte et retour arrière

Aucun fichier de contenu, média, PDF ou donnée anglaise n’est supprimé ou renommé. `multiple_files`, `default_locale: fr`, les chemins et les attributs i18n des champs restent en place : les entrées françaises restent des fichiers `*.fr.json`. Les fichiers `*.en.json` restent versionnés et copiés dans le site comme auparavant, mais ne sont plus proposés à l’édition. Un contenu anglais sans source française continue à bloquer la génération ATR TV plutôt que d’être écarté silencieusement.

Le catalogue conserve les textes anglais historiques et leur repli français pour les consommateurs existants. Les propriétés partagées viennent désormais du fichier français ; les originaux anglais restent intacts dans Git. Avant une éventuelle réactivation du bilinguisme, comparer et réconcilier ces propriétés si des éditions françaises ont eu lieu. Aucun nettoyage anglais n’est prévu dans cette PR.

## Publication et limites

`backend.branch: main`, `open_authoring: true`, OAuth et `publish_mode: editorial_workflow` sont inchangés. Le déploiement Pages exige toujours main et exclut les événements pull_request. La PR ne fusionne et ne déploie rien. Le maintien de `main` dans la configuration CMS conserve la destination éditoriale existante ; il ne signifie pas que cette préparation modifie main.

L’authentification CMS, les brouillons éditoriaux distants et les permissions réelles du propriétaire ne sont pas modifiés ni exercés par les tests locaux. Avant la mise en ligne, le propriétaire doit vérifier dans un environnement isolé la connexion, l’ouverture d’une entrée existante, l’enregistrement d’un brouillon français, sa revue et la publication contrôlée. Examiner aussi tout brouillon anglais déjà ouvert avant fusion ; ne pas le supprimer. Aucun envoi de formulaire ni publication de test n’a été effectué.

## Validations locales

- `node --test tests/atr-tv.test.mjs` : 12 tests réussis.
- `node scripts/build-atr-tv.mjs` et `--site-dir _site` : génération réussie ; une vidéo active existante.
- `node tests/atr-tv.browser.cjs` avec Playwright et Chrome, aperçu local : 1440, 1280, 390 et 320 pixels ; navigation, absence de débordement, filtres, ordre, archives, insertion de texte sûre, lecteur, fermeture, conservation des URL des formulaires, états chargement/vide/erreur/reprise, préférence anglaise historique, fonctionnement sans stockage et changement de campagne à minuit Dakar.
- `node tests/atr-tv.player-audit.cjs` : lecture réelle YouTube sur origine HTTPS simulée localement, quatre variantes ordinateur/mobile, dont cookies tiers bloqués ; lecture observée à partir de 674 secondes, sans erreur et sans débordement. Ce test ne constitue pas un déploiement ni un test sur téléphone physique.
- Comparaison de la configuration avant/après : seuls la liste des langues et un commentaire changent ; aucune modification des collections, champs, accès et workflow.
- `git diff --check` et vérification des contenus et utilitaires inchangés.

Référence du choix de format : [documentation officielle Decap i18n](https://decapcms.org/docs/i18n/).
