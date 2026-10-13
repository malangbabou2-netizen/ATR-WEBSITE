# Audit du lecteur ATR TV — 13 octobre 2026

Cet audit concerne les fichiers de `feature/atr-tv-integration`. Aucun déploiement, modification du domaine, des paramètres GitHub Pages ou des protections de branche n'a été effectué pendant les tests. Le JavaScript du lecteur est conservé ; une correction CSS ciblée garantit désormais sa hauteur minimale.

## Vérifications réussies

- L'iframe utilise `https://www.youtube-nocookie.com/embed/eyeOfSerVw0?start=674&autoplay=1` et `referrerPolicy = strict-origin-when-cross-origin`.
- Les requêtes observées lors des tests isolés à l'origine HTTPS officielle simulée portent `Referer: https://africatwinriders.sn/`. Le `document.referrer` du lecteur confirme cette origine. Une navigation GET d'iframe ne nécessite pas un en-tête HTTP `Origin` supplémentaire.
- Le paramètre `origin` de l'API iframe n'est pas utilisé ; le site n'active pas `enablejsapi=1`. Son absence ne provoque pas l'erreur 153 dans les tests effectués. Si l'API est ajoutée plus tard, fournir alors l'origine réelle du document conformément à la documentation YouTube.
- YouTube répond `playabilityStatus.status: OK` et `playableInEmbed: true` pour « Camp ATR LAC ROSE P1 ». La progression réelle de la lecture est observée au-delà de 674 secondes.
- Chrome 155 : tests desktop, cookies tiers bloqués, émulation mobile 390 px et 320 px. La lecture continue sans erreur 153 dans les quatre cas.
- Hauteur minimale validée après correction : 326 × 200 px à 390 px et 256 × 200 px à 320 px, pour l'iframe et son conteneur. Aucun débordement horizontal du lecteur, de la fenêtre ou de la page. Sur desktop à 1440 et 1280 px, le lecteur reste à 918 × 516,375 px.
- La correction est limitée aux sélecteurs `.atr-tv-embed` et `.atr-tv-embed iframe` de `style.css` : hauteur minimale de 200 px et largeur contrainte à 100 % de l'espace disponible. La largeur explicite évite que le ratio 16:9 associé à la hauteur minimale élargisse le conteneur sur mobile. Le ratio de la vidéo reste géré par YouTube.
- Comparaison du rendu avant/après : les positions, largeurs et hauteurs de toutes les autres sections et de l'en-tête sont identiques à 1440, 1280, 390 et 320 px. Les tests FR/EN, Formspree et du retour automatique du Hero au 1er novembre passent également. Aucun contenu HTML ou JavaScript public n'est modifié par cette correction.
- Le blocage des cookies est vérifié : un cookie synthétique de diagnostic est refusé avec le motif `UserPreferences`, tout en conservant le Referer. Les valeurs des cookies, identifiants de session et réponses complètes de YouTube ne sont pas journalisés.
- Safari 26.6.2 : lecture observée dans l'aperçu HTTP local, à 11 min 14 s. Les réglages de sécurité de Safari ne sont pas modifiés ; SafariDriver signale que l'automatisation distante n'est pas autorisée, donc le test passe par l'interface native.
- Le domaine officiel répond en HTTPS avec validation normale du certificat par curl. Ses en-têtes actuellement observés ne contiennent aucune CSP, Referrer-Policy, Permissions-Policy, COOP ou COEP susceptible de bloquer ce lecteur. Le HTML ne définit pas de politique concurrente.
- L'iframe et les miniatures utilisent HTTPS. Le lecteur autorise autoplay, encrypted-media, picture-in-picture et fullscreen ; aucun sandbox restrictif n'est appliqué. Un lien conservant l'URL YouTube complète est disponible dans la fenêtre.

## Limites et risques résiduels

- Aucune URL de préproduction HTTPS hébergée n'est disponible. Le test HTTPS est une simulation navigateur des fichiers locaux sous l'origine officielle ; il ne remplace pas un test sur le futur déploiement Pages réel.
- Les téléphones iOS/Android physiques ne sont pas testés. L'émulation Chrome et Safari desktop ne garantissent pas le comportement de Safari iOS, des WebViews ou des navigateurs intégrés aux réseaux sociaux.
- La réserve initiale sur la hauteur mobile est levée : les mesures précédentes de 326 × 183,375 px et 256 × 144 px sont remplacées par 326 × 200 px et 256 × 200 px. Les assertions de dimensions et de débordement sont intégrées aux tests navigateur et à l'audit du lecteur réel.
- Un bloqueur de contenu peut bloquer YouTube lui-même ou retirer le Referer. Un blocage des cookies tiers seul ne reproduit pas l'erreur 153 dans les tests ; un blocage de ressources/référent est une situation différente.
- Une vidéo peut devenir privée, restreinte par âge/pays ou interdite d'intégration après cet audit. L'autoplay sonore peut être refusé selon les réglages du navigateur ; l'utilisateur devra alors utiliser le bouton de lecture du lecteur.
- Le domaine `youtube-nocookie.com` correspond au mode de confidentialité avancé, pas à une garantie d'absence totale de stockage ou de requêtes tierces après lancement de la vidéo.
- Si une CSP est ajoutée ultérieurement, autoriser le domaine du lecteur dans `frame-src` et les miniatures dans `img-src`. Conserver une politique de référent transmettant l'origine, sans `no-referrer` ni `same-origin` sur l'iframe.

## Positionnement demandé

Le menu et les sections de la page utilisent l'ordre **Événements → ATR TV → Aventures des membres**. Les blocs HTML sont déplacés sans réécrire leurs contenus. Les tests contrôlent cet ordre et les liens FR/EN sur desktop et mobile.

## Contrôles restant avant publication définitive

1. Tester sur une vraie URL HTTPS de préproduction si un hébergement de test est autorisé, sans changer la source Pages officielle.
2. Tester sur iPhone/Safari et Android/Chrome physiques, avec protection contre le suivi, cookies tiers bloqués et lecture manuelle si l'autoplay est refusé.
3. Après publication expressément autorisée, refaire le contrôle du Referer, des politiques reçues et de la lecture sur le domaine officiel. Les protections de `main` et l'approbation du propriétaire restent nécessaires.

## Sources officielles

- [YouTube IFrame API : erreur 153 et dimensions du lecteur](https://developers.google.com/youtube/iframe_api_reference).
- [Identification des lecteurs intégrés et Referer](https://developers.google.com/youtube/terms/required-minimum-functionality#embedded-youtube-player).
- [Mode de confidentialité avancé](https://support.google.com/youtube/answer/171780?hl=fr).

Test optionnel reproductible : avec Playwright installé et Chrome disponible, exécuter `node tests/atr-tv.player-audit.cjs`. Le fichier `atr-tv-catalog.json` doit avoir été généré localement. Le test ne déploie rien et utilise un profil Chrome isolé. Les restrictions ou indisponibilités ultérieures du fournisseur peuvent faire échouer ce test réseau ; elles doivent être examinées avant de conclure à un défaut du site.
