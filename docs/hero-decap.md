# Administrer les bannières Hero

Cette modification doit être relue et fusionnée par le propriétaire. La PR ne déploie pas le site. Aucun contenu de test n’est ajouté aux publications.

Après validation et déploiement de la PR :
1. Ouvrir `/admin/`, puis **Partenaires et bannières** et créer une fiche.
2. Renseigner le nom de la campagne, choisir **Accueil — Hero**, importer l’image et décrire son contenu dans le texte alternatif. Le lien HTTPS est facultatif pour le Hero (obligatoire ailleurs).
3. Préparer de préférence un WebP ou JPEG 1920 × 1080, 16:9, avec un texte lisible. Une image mobile facultative peut simplifier le visuel ; elle occupe le même cadre 16:9. Le site affiche toute l’image sans déformation ni découpe : les autres proportions présentent des marges. La qualité dépend du fichier fourni ; le site ne recompresse pas les originaux. Viser quelques centaines de Ko par visuel et éviter les textes minuscules.
4. Choisir les dates **et heures de Dakar (Africa/Dakar, UTC)**. Le sélecteur reste en UTC même si l’ordinateur utilise un autre fuseau. Le début est inclus ; à l’heure de fin, la bannière disparaît. Les anciennes valeurs sans heure conservent une fin en fin de journée. Les autres emplacements continuent à fonctionner par journées entières.
5. Cocher **Bannière active**, régler la priorité (plus élevée d’abord), puis suivre le circuit éditorial Decap. Une entrée archivée ou inactive ne paraît pas. Vérifier les dates avant publication.
6. Plusieurs fiches Hero peuvent se chevaucher. Elles défilent toutes, par priorité, toutes les six secondes. La première change à chaque actualisation dans le même onglet si le stockage de session est disponible ; sinon elle est choisie aléatoirement.

Les commandes Précédente, Suivante, Pause/Reprendre sont utilisables au clavier ; les flèches gauche/droite fonctionnent dans le carrousel. Survol, focus et onglet masqué suspendent la rotation. La préférence de réduction des animations désactive la rotation initiale. Une seule bannière n’affiche pas de commandes inutiles.

Sans bannière éligible, en cas d’échec de chargement du catalogue ou si les images échouent, le Hero existant reprend sa place, avec sa campagne historique et ses boutons. Les horaires sont réévalués automatiquement sans nouvelle construction du site. Une modification CMS requiert toujours la publication et la construction habituelles.

## Vérifications

`node --test tests/atr-tv.test.mjs tests/cms-content.test.mjs tests/hero-carousel.test.mjs`

`node scripts/build-atr-tv.mjs --site-dir _site`

Les tests navigateur utilisent des données interceptées localement, jamais des fiches publiées. Avant fusion, vérifier le statut de la PR et relire les changements. Aucune fusion automatique ne doit être activée.

Test navigateur local : `node tests/hero-carousel.browser.cjs` (Playwright et Chrome requis). Le test intercepte toutes les ressources du site et ne publie aucune donnée.

Configuration du sélecteur vérifiée dans la documentation Decap : https://decapcms.org/docs/widgets/datetime/ (`picker_utc: true`).
