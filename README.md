# Le jeu des mariés

Application web de jeu d'énigmes, construite avec React, TypeScript et Vite. Elle fonctionne en mode local sans configuration Firebase et peut synchroniser les profils, résolutions et scores avec Firebase Auth anonyme et Firestore.

## Démarrer

Installer Node.js 20 ou plus récent, puis lancer :

```sh
npm install
npm run dev
```

## Personnaliser les énigmes

Modifier `src/data/puzzles.ts` : chaque entrée contient son titre, son texte, sa réponse et éventuellement une image. Les énigmes de démonstration sont à remplacer par celles du mariage. Les réponses étant vérifiées dans le navigateur, elles sont visibles dans les fichiers livrés au navigateur et les scores peuvent être falsifiés.

Une énigme peut aussi utiliser `images` pour afficher plusieurs visuels comparatifs; ils sont côte à côte sur grand écran et empilés sur mobile.

La limite est de trois tentatives par défaut. Pour la modifier sur une énigme, ajouter `maxAttempts: 1` (ou un autre nombre) à son entrée; les tentatives sont conservées dans Firestore ou dans le stockage local du navigateur.

La tuile 08 ouvre le runner 3D. Les FBX attendus sont dans `public/models/game/`; le personnage sélectionné et ses animations sont préchargés dès que son profil est prêt, avant l’ouverture du runner. Cela télécharge environ 48 à 54 Mo selon l’équipe; le préchargement est sauté si le navigateur active `Save-Data`. Les commandes sont flèche haut/espace pour sauter et flèche bas pour rouler; les boutons tactiles sont affichés sous la scène. Les parties sont illimitées : seul le nouveau record personnel ajoute la différence au score total, une seule fois.

La tuile 09 ouvre Dance Battle. Le meilleur score d'une partie terminée contribue au classement de la même façon : seule l'amélioration du record est ajoutée au total. Les records des deux jeux sont indépendants.

Netlify sert les fichiers sous `/models/*` avec `Cache-Control: public, max-age=31536000, immutable`. Le navigateur peut ainsi réutiliser les FBX et GLB sans les télécharger à nouveau pendant un an. Comme ces fichiers n'ont pas de nom hashé automatiquement, donne un nouveau nom à un modèle quand tu remplaces son contenu et mets à jour ses références dans le code; sinon les visiteurs pourraient conserver l'ancienne version en cache.

L'énigme 5 est une chasse aux cinq lettres du mot `BAGUE`. Les chemins QR sont définis dans `src/data/treasureClues.ts`; chaque page affiche uniquement sa lettre et le lien de retour au jeu. Dans l'administration (`/admin-2027`), saisir le domaine de production puis copier chaque URL pour générer les QR codes. Les URL sont accessibles sans inscription et les liens profonds sont réécrits vers l'application par la configuration Netlify.

## Administration

Ouvrir directement `/admin-2027` pour afficher la page organisateur. Le mot de passe provisoire est `mariage-admin-2027`, défini dans `src/features/AdminPage.tsx`; modifie-le avant de partager l’application. Pour chaque joueur, la page permet de remettre à zéro ses tentatives sur toutes les énigmes ou de le supprimer avec sa progression. Le reset global reste disponible; ces resets ne modifient ni les scores ni les réponses déjà validées.

La fiche de chaque joueur détaille les points des énigmes et les records des jeux. En mode local, les points d'énigmes enregistrés avant cette fonctionnalité peuvent être indisponibles dans le détail : le total du joueur reste inchangé. Les données locales ne sont disponibles que sur l'appareil où elles ont été enregistrées.

Cet accès est uniquement un écran de dissimulation : le mot de passe est inclus dans le code JavaScript envoyé au navigateur et les règles Firestore autorisent les utilisateurs authentifiés à écrire les données. Ne l’utilise pas pour protéger des données sensibles.

Le texte des énigmes accepte une mise en forme Markdown limitée : `**gras**`, `*italique*`, code inline, paragraphes séparés par une ligne vide et listes numérotées ou à puces. Le HTML brut n'est pas interprété.

Pour remplacer l'aperçu 3D par les personnages Mixamo, ajouter `public/models/groom.fbx` et `public/models/bride.fbx`. Les fichiers doivent inclure leur animation et être adaptés au chargement Web; la scène conserve les anneaux animés si le modèle d'une équipe est absent.

## Activer Firebase

Créer une application Web Firebase, activer l'authentification anonyme et Firestore, puis définir ces variables `VITE_FIREBASE_*` dans un fichier `.env.local` :

```text
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_APP_ID=
```

Sans ces variables, l'application conserve les données dans le navigateur courant. Le mode local ne synchronise pas les appareils.

## Vérifier et construire

```sh
npm run build
npm run preview
```

Le dossier `dist/` peut être déployé sur Netlify en tant que site statique. Configurer `npm run build` comme commande de build et `dist` comme dossier de publication.

Vite ajoute automatiquement un hash de contenu aux bundles de production sous `dist/assets/`. Netlify leur applique un cache navigateur d'un an (`immutable`); `index.html` est revalidé à chaque visite pour référencer les nouveaux bundles après un déploiement. Les fichiers placés dans `public/` ne sont pas renommés ni hashés automatiquement : pour les modèles sous `public/models/`, change leur nom lorsque leur contenu est remplacé.