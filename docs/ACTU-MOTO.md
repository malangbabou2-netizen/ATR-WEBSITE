# L’ACTU MOTO — proposition à valider

## État réel au 19 octobre 2026

L’interface et la collecte sont préparées. **Aucune source n’est actuellement activée** : aucun média examiné ne réunit à ce stade un RSS accessible et une autorisation suffisamment explicite pour la republication des titres/extraits et leur traduction sur ATR. Le catalogue livré est donc vide, sans articles fictifs. L’accueil affiche un message de préparation. Ce n’est pas un fil éditorial déjà opérationnel.

L’interface peut être examinée avec les fixtures synthétiques du test navigateur ; ces fixtures n’entrent jamais dans le site publié.

## Emplacement et navigation

Le module se trouve immédiatement après le Hero et avant les bannières CMS et la présentation d’ATR. Une seule carte s’affiche à la fois, avec rotation à 6 secondes, précédent/suivant et pause/reprise. Survol, focus clavier et onglet masqué suspendent le minuteur. Chaque reprise attend 6 secondes. Avec `prefers-reduced-motion: reduce`, le défilement reste arrêté au démarrage ; l’utilisateur peut le démarrer. Les cartes masquées sont retirées de la navigation et de l’arbre d’accessibilité. La rotation automatique n’annonce pas chaque carte au lecteur d’écran.

`actualites.html` affiche jusqu’à 60 actualités récentes (30 jours), avec date, média, titre, extrait français et lien vers l’article. L’accueil montre les 8 premières. Les traductions sont signalées. Les titres/extraits sont insérés comme texte, jamais comme HTML distant. Aucun pixel de suivi ni image de média n’est repris. Les articles complets restent chez leurs éditeurs.

Le CMS Decap, sa collection manuelle `moto-news`, ses contenus, formulaires, campagnes et carrousel principal ne sont pas modifiés. Les actualités manuelles existantes conservent leur emplacement actuel ; le nouveau fil RSS est indépendant.

## Audit des sources

Vérification des pages officielles le 19 octobre 2026. Un RSS disponible n’est pas traité comme une licence de traduction ou une autorisation d’images.

| Source | Vérification technique / droits | Décision |
| --- | --- | --- |
| Total Motorcycle | GET `https://www.totalmotorcycle.com/feed/` : HTTP 200, `application/rss+xml`, RSS XML parsé, 30 articles ; premier article daté du 19 octobre 2026 à 15:34:48 UTC. [Flux annoncé](https://www.totalmotorcycle.com/fan). Les [conditions officielles](https://www.totalmotorcycle.com/termsofuseandprivacypolicy) réservent la reproduction, modification et republication à un accord écrit. | Configuré mais désactivé. Demander les droits titres/extraits + traduction + cache pour ATR. Aucun contenu du flux n’est livré dans cette PR. |
| Motorcyclist | La [page officielle RSS](https://www.motorcyclistonline.com/motorcyclist-rss-feed/) autorise l’affichage gratuit de ce que fournit le flux avec attribution. GET de l’adresse candidate `/arc/outboundfeeds/rss/` : HTTP 404, `text/plain`. Cette adresse n’est pas un flux validé. La page ne confirme pas explicitement la traduction. | Exclu : retrouver une adresse officielle fonctionnelle et confirmer la traduction. |
| Moto Magazine | Les [mentions légales officielles](https://www.motomag.com/mentions-legales/) imposent un accord pour la reproduction même partielle et s’opposent à l’extraction automatisée. | Exclu ; pas de collecte de contenu. |
| Moto-Net.Com | [Annuaire officiel RSS](https://www.moto-net.com/page/les-flux-rss-de-moto-net-com.html) destiné notamment aux webmasters ; l’existence de flux ne confirme pas suffisamment le droit de réutiliser les extraits sur ATR. | Non inclus ; demander un accord de syndication précisant les champs et le cache. |
| Motorcycle Sports / M Sports | [Politique de syndication officielle](https://motorcyclesports.net/ai-licensing/) : attribution et lien exigés, licence explicite pour réutilisation commerciale. L’autorisation d’indexation IA ne valide pas la republication/traduction par ATR. | Exclu tant que les conditions applicables au site du GIE et la traduction ne sont pas confirmées. |

Motorcycle Daily, ADV Rider, Motorcycle.com et Visordown évoqués précédemment ne sont pas présentés comme validés et ne sont pas inclus. Aucun accord n’a été demandé aux éditeurs au nom de l’utilisateur.

### Activer une source après autorisation

1. Obtenir une licence publique explicite ou un accord écrit couvrant ATR, les titres, extraits, traduction, cache et attribution ; conserver une référence vérifiable dans `rights.evidence` et la date dans `rights.checked_at`.
2. Vérifier en réseau l’adresse HTTPS, le RSS 2.0 et la fraîcheur. Renseigner les seuls domaines légitimes dans `hosts`. Le collecteur n’accepte que les liens HTTPS de ces domaines.
3. Mettre `rights.redistribution: true`, et pour l’anglais `rights.translation: true`, puis `enabled: true` dans `news/sources.json`, dans une PR revue.
4. Exécuter le workflow manuellement après validation de cette intégration ; examiner le résultat et la traduction avant publication. Il faut un extrait présent dans le RSS : aucun scraping d’article ni résumé inventé.

Les images sont exclues par construction, y compris les images intégrées au HTML, les enclosures et les miniatures. Une future évolution vers des photos exigera une autorisation documentée distincte (auteur, licence, attribution, périmètre). Ne pas activer une source simplement parce que son RSS est gratuit à lire.

## Traduction gratuite validée techniquement

[Argos Translate](https://github.com/argosopentech/argos-translate), bibliothèque libre, est exécuté localement sur le runner : pas de clé, quota d’API externe ou abonnement de traduction. Version de bibliothèque : 1.11.0. Modèle officiel anglais → français : 1.9, téléchargé depuis `https://argos-net.com/v1/translate-en_fr-1_9.argosmodel` et vérifié par SHA-256 :

`3a65ed83364f4e7b06e30f9dd823db1934899ed3ce839e63f46dc7b09dc797b4`

Le README du modèle indique une dérivation OPUS-MT sous CC BY 4.0 et crédite Jörg Tiedemann et Santhosh Thottingal, « OPUS-MT — Building open translation services for the World », EAMT 2020. Le modèle est installé par le workflow et n’est pas redistribué dans le site.

Test réel sur Python 3.12, Argos 1.11.0 et MiniSBD (Mac ARM, 19 octobre 2026) :

- Entrée synthétique : `Motorcycle riders travel together. Wear a helmet and check your brakes before every ride.`
- Sortie obtenue : `Les motocyclistes voyagent ensemble. Portez un casque et vérifiez vos freins avant chaque course.`

La traduction fonctionne techniquement, mais « course » illustre une nuance à relire avant publication. Ce test ne démontre pas une qualité éditoriale parfaite ni l’exécution réussie sur Ubuntu Actions : un test identique est intégré à la CI Ubuntu de la Pull Request et à la préparation du modèle lorsqu’une source anglophone est approuvée. Une traduction vide ou identique à l’anglais est rejetée ; le cache français précédent reste disponible. La mémoïsation évite de retraduire les mêmes titres/extraits.

Le logiciel ne facture pas de traduction. Les minutes et le stockage GitHub Actions restent soumis aux conditions du compte ; aucune garantie de gratuité illimitée de l’hébergement n’est faite.

## Collecte horaire et validation avant publication

`.github/workflows/moto-news.yml` se déclenche à la minute 17 de chaque heure (UTC) sur la branche par défaut après fusion, ou manuellement. Les horaires Actions peuvent être retardés ; ce n’est pas un engagement de mise à jour à heure fixe. Il ne tourne pas automatiquement depuis la branche de cette PR.

Le workflow :

- installe le traducteur seulement si une source anglaise est autorisée ;
- récupère chaque RSS avec délai maximal 25 s et taille maximale 2 Mo, refuse les déclarations XML DTD/entities ;
- nettoie les extraits, dédoublonne par URL canonique sans paramètres de suivi et par titre normalisé ;
- conserve au maximum 60 articles de moins de 30 jours ;
- conserve les articles français précédents si un média ou une traduction échoue ;
- purge aussi le cache de secours lorsqu’une source est désactivée ou ses droits retirés ;
- produit un artefact de contrôle, puis propose les fichiers de cache dans une PR **brouillon** sur `automation/moto-news-cache`, sans fusion ni déploiement.

Le workflow nécessite que le dépôt autorise GitHub Actions à créer des Pull Requests. Si ce réglage est désactivé, l’artefact reste téléchargeable et la création de PR échoue explicitement ; ne pas ajouter de jeton personnel pour contourner ce réglage. Une seule PR de cache reste ouverte et est actualisée ; ne pas modifier directement sa branche automatique.

**La récupération est horaire ; la publication reste soumise à validation humaine.** La fusion d’une PR vers `main` déclenche la procédure Pages existante du dépôt. Ne fusionner aucune PR, y compris les mises à jour de cache, sans validation de publication. Ce choix évite qu’une collecte horaire republie automatiquement le site à l’insu de l’utilisateur.

En cas d’échec HTTP/JSON du catalogue côté navigateur, `news/fallback.json` prend le relais. Les articles périmés sont filtrés même sans nouvelle collecte. Une donnée de plus de 48 h ou le secours affiche un avertissement de mise à jour indisponible. Aucun stockage navigateur de contenus tiers ne survit à un retrait de droits.

## Fichiers et vérifications

- `index.html`, `moto-news.mjs`, `moto-news.css` : module d’accueil.
- `actualites.html`, `sitemap.xml` : page complète et découverte.
- `news/` : liste des droits, catalogue et secours vides tant que les sources ne sont pas approuvées.
- `scripts/fetch-moto-news.py`, `setup-news-translation.py`, `news-requirements.txt` : collecte et modèle.
- `scripts/build-atr-tv.mjs` : ajout des dépendances publiques à l’artefact existant ; les sources, traductions mémorisées et instructions internes ne sont pas publiées.
- Workflows et tests : contrôle des nouvelles fonctions et conservation des tests CMS/TV/Hero existants.

Commandes reproductibles :

```sh
node --test tests/*.test.mjs
python3 -m unittest discover -s tests -p moto_news_test.py
node scripts/build-atr-tv.mjs --site-dir _site
# Avec playwright et axe-core installés, puis Chromium installé :
node tests/moto-news.browser.cjs
# Avec les variables ARGOS_PACKAGES_DIR et XDG_* pointant vers un dossier local :
pip install -r scripts/news-requirements.txt
ARGOS_CHUNK_TYPE=MINISBD python scripts/setup-news-translation.py
```

L’audit axe couvre le nouveau module et la nouvelle page complète ; il ne certifie pas tout le site historique. Le lecteur d’écran n’est pas testé manuellement. Les données de navigateur sont uniquement synthétiques. Aucun article ni aucune photo sans droit ne doit être ajouté pour rendre la démonstration plus réaliste.
