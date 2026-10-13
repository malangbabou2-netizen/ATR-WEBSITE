# ATR TV — intégration locale et publication

La collection Decap existante `content/atr-tv/<slug>.fr.json` et `.en.json` reste la source des vidéos. Les contenus ne sont affichés qu'après leur fusion dans `main` par le propriétaire. Aucun droit GitHub, secret OAuth, formulaire ou réglage Pages n'est changé par ces fichiers.

## Génération et aperçu local

Prérequis : Node.js 22 ou supérieur et Git. Aucune dépendance npm ni API payante.

```sh
node --test tests/atr-tv.test.mjs
node scripts/build-atr-tv.mjs
python3 -m http.server 8080
```

Ouvrir `http://localhost:8080/#atr-tv`. Utiliser HTTP : les modules JavaScript et le chargement JSON ne fonctionnent pas normalement dans un aperçu `file://`. Le catalogue généré `atr-tv-catalog.json` est ignoré par Git. Relancer le générateur après une modification locale des données.

Pour contrôler le même artefact que GitHub Pages :

```sh
node scripts/build-atr-tv.mjs --site-dir _site
python3 -m http.server 8080 --directory _site
```

Le dossier de sortie doit être neuf pour une publication ; le runner Actions fournit un checkout neuf à chaque exécution. Seuls les fichiers publics suivis par Git et les fichiers de rendu explicitement autorisés sont copiés. Les fichiers système, fichiers locaux non suivis, Worker OAuth, tests et documentation sont exclus de l'artefact. Les contenus Decap dans le dépôt public restent publics, même lorsqu'ils sont archivés : ne jamais y mettre de données privées ou de soumissions Formspree.

## Règles de contenu

- Le titre français est obligatoire. Une traduction anglaise absente ou vide utilise le texte français, champ par champ.
- Les champs partagés entre FR/EN doivent correspondre ; une divergence bloque la construction plutôt que publier une version incohérente.
- `archived: true` exclut la vidéo du catalogue. Les fichiers source sont conservés.
- Les vidéos `featured` sont affichées en premier et identifiées « À la une » / « Featured ». Plusieurs vidéos mises en avant sont acceptées.
- Dans chaque groupe, `sort_order` croissant puis le slug fixent un ordre stable.
- `category` détermine le libellé bilingue et le filtre. Les valeurs autorisées sont celles de la collection Decap.
- Les URL HTTPS YouTube sont vérifiées. Le lecteur intégré conserve le point de départ (`t` ou `start`), les paramètres de liste et les autres paramètres de lecture pris en charge. Le lien « Ouvrir sur YouTube » conserve l'URL d'origine complète.
- Les couvertures locales sont facultatives ; sinon la vraie miniature YouTube est utilisée. Le lecteur n'est chargé qu'après clic, avec une fenêtre accessible fermable par Échap.
- La chaîne officielle et l'abonnement utilisent `https://www.youtube.com/@AfricaTwin-riders221`, défini dans `atr-tv-utils.mjs`.

## Activation ultérieure, uniquement après autorisation

1. Faire examiner les changements sur `feature/atr-tv-integration`. Aucun push, commit ou déploiement n'est nécessaire pour l'aperçu local.
2. Au moment de la publication approuvée, sélectionner **Settings → Pages → Build and deployment → Source: GitHub Actions**. La source actuelle « Deploy from a branch » ne lance pas ce générateur avant le rendu ; laisser cette source empêcherait la rubrique de fonctionner.
3. Conserver le domaine personnalisé, les DNS, HTTPS et les protections de `main`. Vérifier que l'environnement `github-pages` autorise uniquement `main` et conserve les exigences d'approbation souhaitées. Ne donner aucun droit d'écriture au gestionnaire.
4. Le propriétaire fusionne la PR validée. Le workflow teste et construit le site, puis déploie uniquement depuis `main`. Une PR, notamment issue d'un fork, exécute la validation et ne peut pas lancer le job de déploiement.
5. Contrôler l'URL publique, le catalogue, FR → EN → FR, les filtres et le point de départ de la vidéo réelle.

Chaque nouvelle publication Decap fusionnée dans `main` relance ensuite automatiquement le workflow. Le générateur n'écrit aucun commit et ne contourne pas les protections de branche. Si la validation échoue, aucun nouvel artefact n'est déployé et la version publique précédente reste disponible.

## Retour arrière

Conserver l'identifiant du dernier commit public fonctionnel avant activation. Le propriétaire peut rétablir le code via une PR de revert respectant les protections, puis laisser le workflow redéployer. Pour revenir à l'ancien mode Pages, rétablir aussi la source `main /` après validation ; cette opération désactive la génération automatique ATR TV. Aucun rollback ne nécessite de push forcé.
