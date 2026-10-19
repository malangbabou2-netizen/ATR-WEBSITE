# Audit SEO et préparation AdSense — ATR

Audit du 19 octobre 2026. Branche distincte de `codex/actu-moto` / PR n° 17. Aucune fusion, publication, modification DNS, inscription AdSense ou intervention Search Console autorisée à cette étape.

## Périmètre vérifié réellement

Lecture HTTP du domaine officiel et inspection de `main` (`4a44b7c` au début de l’audit). Le navigateur de recherche ne pouvait pas lire le domaine ; les réponses ci-dessous ont été vérifiées directement par des requêtes HTTP en lecture seule.

| Adresse | Résultat observé avant correction |
| --- | --- |
| `https://africatwinriders.sn/` | HTTP 200, HTML, français ; aucun `noindex` ni en-tête X-Robots-Tag bloquant |
| `http://africatwinriders.sn/` | Redirection suivie vers la version HTTPS sans www, réponse finale 200 |
| `https://www.africatwinriders.sn/` | Redirection suivie vers la version HTTPS sans www, réponse finale 200 |
| `/robots.txt` | HTTP 200, texte ; `Allow: /` et référence correcte au sitemap officiel |
| `/sitemap.xml` | HTTP 200, XML ; une seule URL, l’accueil canonique |
| `/admin/` | HTTP 200 avec `meta robots="noindex, nofollow"` ; exclu du sitemap |
| `/actualites.html` | HTTP 404 ; appartient à la PR n° 17 non publiée, ne doit pas figurer dans ce sitemap |
| `/mentions-legales.html` et `/confidentialite.html` | HTTP 404 ; aucun lien vers de telles pages dans l’accueil actuel |

Les seuls HTML suivis et publiés sur main sont `index.html` et `admin/index.html`. Événements, activités, aventures, Ride & Give, contact et ATR TV sont des sections d’accueil, pas des pages HTML autonomes. Ne pas inventer des URL à partir des ancres. Les JSON CMS et catalogues ne sont pas des pages éditoriales à ajouter au sitemap. Les PDF ne sont pas inclus dans ce sitemap HTML.

## Résultats SEO

- Title existant correct et conservé : « Africa Twin Riders Sénégal | ATR ». Une seule balise H1 dans le HTML, langue `fr`.
- Meta description existante correcte mais générale : enrichie avec les activités validées (road trips, off-road, sécurité, solidarité), sans nouvelle information ATR. Descriptions Open Graph et Twitter alignées.
- Canonical, `og:url`, image Open Graph et Twitter utilisent le domaine HTTPS officiel sans www. Aucune ancienne adresse GitHub Pages dans les liens publics HTML inspectés.
- Image sociale existante `images/hero-ATR.jpg` : JPEG 1672 × 941 px, dimensions vérifiées ; type `image/jpeg` explicité. Image non modifiée, sans changement du Hero.
- Liens internes et ancres HTML : aucune cible absente constatée ; les tests vérifient également les dépendances locales (images, scripts, CSS et PDF) et l’absence d’identifiants dupliqués.
- Navigation publique : liens de sections présents, contact et présentation ATR disponibles. Pas de lien vers les brouillons ou l’administration depuis la navigation publique.
- Les cartes CMS/ATR TV sont rendues en JavaScript après récupération de JSON. L’audit ne prouve pas leur indexation par Google. Après validation, contrôler le rendu avec l’inspection d’URL de Search Console. D’éventuelles pages de récits originales et pré-rendues seraient une évolution séparée, pas une copie automatique des brouillons.

## Sitemap préparé

`scripts/build-sitemap.mjs` est exécuté à la fin du build Pages par `scripts/build-atr-tv.mjs` et inspecte uniquement le dossier de publication, jamais les branches CMS ni l’ensemble du dépôt.

- Découverte des HTML réellement présents dans l’artefact, y compris les sous-pages publiques.
- Exclusion des répertoires admin, contenu source, brouillons, aperçu, docs internes, tests et médias ; exclusion de la page 404, des redirections HTML et des pages `noindex`/`googlebot none`.
- URL absolues du domaine officiel, canoniques uniques et auto-référentes obligatoires ; une erreur bloque le build plutôt que d’annoncer une mauvaise URL.
- Pas de dates `lastmod` artificielles, de fragments ni de doublon `/index.html`.
- Après préparation de la page de mentions légales demandée et confirmation de son responsable, de son adresse et de ses contacts, le sitemap source et le sitemap généré contiennent deux URL : l’accueil et `/mentions-legales.html`. Cette seconde page est proposée dans cette PR et n’est pas encore en ligne. La copie publiée est régénérée après chaque build.
- Une future page doit d’abord être explicitement autorisée dans les fichiers publics du build, contenir sa canonical et être approuvée. Le sitemap l’intègre ensuite sans liste manuelle supplémentaire. Le générateur ne décide jamais qu’un contenu est approuvé et ne publie aucune branche.

`robots.txt` est conservé : il ne bloque pas CSS, JavaScript ou catalogues publics nécessaires au rendu. Ne pas bloquer `/admin/` par robots.txt pour tenter de faire appliquer `noindex` : Google doit pouvoir lire cette directive. `noindex` n’est ni une authentification ni une garantie de confidentialité d’un dépôt public.

## Préparation AdSense : candidature non prête à ce stade

### Éléments favorables observés

Identité ATR visible, navigation, présentation, événements historiques, activités solidaires et contact. Les tests existants couvrent le responsive et les formulaires. Le contenu comporte des informations propres à ATR, mais la propriété de chaque photographie, PDF et vidéo n’a pas été certifiée par cet audit. Les vidéos YouTube intégrées ne suffisent pas à démontrer l’originalité de toute une page.

### Éléments restant à préparer et valider

1. **Mentions légales** : informations juridiques expressément fournies par le propriétaire pour la mise à jour de cette PR : dénomination **AFRICA TWIN RIDERS**, forme **GIE**, RCCM **SN.DKR.2026.C.18070**, NINEA **013058856**, siège **Rufisque, Cité Filao, Villa n° 42, Sénégal**. **Malang Babou** est indiqué comme président et représentant légal du GIE ainsi que gestionnaire technique du site. Les adresses **samabusinesscom@gmail.com** et **malangbabou2@gmail.com** sont conservées sous réserve de validation avant publication. Ces données remplacent l’adresse initialement fournie « Rufisque, Cité Filaos ». Aucun document administratif numérisé n’a été fourni dans cette demande ni ajouté au dépôt ; les données sont reprises de la confirmation explicite du propriétaire, sans prétendre avoir contrôlé les pièces originales. Aucune date de naissance, signature ou adresse personnelle d’un autre membre n’est ajoutée. La page ne constitue pas une certification de conformité légale exhaustive.
2. **Politique de confidentialité** : responsable et contact, finalités des deux formulaires Formspree, champs recueillis, destinataires et accès, durées de conservation effectives (y compris courriels et exports), suppression et droits, prestataires, éventuels transferts et données techniques. Les durées et bases légales doivent être confirmées ; ne pas promettre un délai ou une suppression non mise en œuvre.
3. **Services existants à décrire fidèlement** : hébergement GitHub Pages ; Formspree pour intérêt et propositions d’aventures ; miniatures YouTube distantes et lecteur `youtube-nocookie.com` après action de lecture ; préférence de langue `atr-language` dans localStorage. Le mode YouTube « nocookie » ne permet pas d’affirmer qu’aucune donnée n’est transmise à un tiers. Pas de code AdSense ni Google Analytics détecté dans les scripts publics inspectés.
4. **Si AdSense est ultérieurement activé** : compléter les informations sur les cookies et partenaires Google, leurs finalités et les choix des visiteurs ; vérifier les exigences de consentement applicables aux audiences visées et la CMP nécessaire. Ne pas présenter les publicités comme déjà actives. Ne pas installer un bandeau fictif sans gestion effective des consentements.
5. **Contenus** : conserver et enrichir des publications originales approuvées, utiles et navigables ; vérifier les droits des médias. Un agrégateur de liens ou des traductions ne garantissent pas l’acceptation. La PR n° 17 reste indépendante et non fusionnée.
6. **Candidature** : confirmer l’identité et la capacité du titulaire AdSense, sa propriété du site et les conditions du programme. Aucun identifiant `pub-...`, fichier ads.txt, revenu, audience ou nombre d’articles requis inventé. Google décide de l’approbation ; cet audit ne la garantit pas.

La page de mentions légales contient uniquement les informations confirmées et les services effectivement utilisés. Aucune politique de confidentialité fictive ni page avec champs à compléter n’est publiée. Le présent document prépare la politique et reste hors `_site`. Après validation des informations manquantes sur les traitements, créer `confidentialite.html` avec title, description et canonical propres, la relier depuis le pied de page et l’inclure explicitement dans le build ; le sitemap la découvrira. Une nouvelle validation est requise avant publication.

## Search Console : étapes après validation et publication

- Utiliser une propriété couvrant le domaine officiel et vérifier sa propriété avec une méthode choisie par le propriétaire. Aucun accès ou enregistrement DNS créé dans cette mission.
- Envoyer `https://africatwinriders.sn/sitemap.xml` et vérifier sa lecture.
- Inspecter l’accueil, sa canonical choisie par Google et le rendu de ses contenus JavaScript ; demander l’indexation si approprié.
- Examiner les exclusions et erreurs 404 ; ne pas soumettre l’administration, les pages de PR non fusionnées ni les brouillons.
- Un sitemap facilite la découverte ; il ne garantit ni indexation, ni positionnement, ni approbation AdSense.

## Sources officielles consultées le 19 octobre 2026

- Google Search Central : [construction des sitemaps](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap?hl=fr).
- Google Search Central : [exclusion par noindex](https://developers.google.com/search/docs/crawling-indexing/block-indexing?hl=fr).
- Google AdSense : [critères d’éligibilité](https://support.google.com/adsense/answer/9724?hl=fr).
- Google AdSense : [règlement des éditeurs](https://support.google.com/adsense/answer/10502938?hl=fr).
- Google AdSense : [informations de confidentialité obligatoires](https://support.google.com/adsense/answer/1348695?hl=fr).
- Google AdSense : [Confidentialité et messages](https://support.google.com/adsense/answer/10924669?hl=fr).

## Contrôles

Tests Node existants CMS/ATR TV/Hero/Decap et nouveaux tests SEO ; sitemap testé avec 0, 1, 2 et 7 pages supplémentaires, sans imposer un nombre fixe aux contenus. Vérification de l’artefact, métadonnées, liens internes, dépendances, admin et non-publication des dossiers internes. Aucun test de formulaires n’envoie de données réelles. Le compte Search Console, l’état d’indexation Google réel et l’approbation AdSense ne sont pas vérifiables sans accès aux comptes du propriétaire.

Résultats locaux finaux : **52 tests Node réussis, aucun échec** ; build `_site` réussi avec deux URL canoniques dans le sitemap ; test navigateur SEO/mentions en 320, 768 et 1440 px réussi, captures examinées, sans débordement ; tests navigateur CMS en 320/390/768/1440 réussis (formulaires, contenus historiques, collections 0/1/2/7, responsive et retour du Hero à minuit Dakar). Fichiers internes absents de l’artefact vérifié via HTTP local. Aucune soumission réelle de formulaire ni modification du site officiel.

Commandes de contrôle :

```sh
node --test tests/atr-tv.test.mjs tests/cms-content.test.mjs tests/hero-carousel.test.mjs tests/decap-media.test.mjs tests/seo.test.mjs
node scripts/build-atr-tv.mjs --site-dir _site
# Servir _site en HTTP local ; Playwright et Chrome nécessaires pour les suites optionnelles :
ATR_SEO_URL=http://127.0.0.1:8092/ node tests/seo.browser.cjs
ATR_CMS_URL=http://127.0.0.1:8092/ node tests/cms-content.browser.cjs
```
