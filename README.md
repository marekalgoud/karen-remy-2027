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

La tuile 08 ouvre le runner 3D. Les FBX attendus sont `public/models/game/Fast Run.fbx` (personnage/course), `Jump.fbx` et `Sprinting Forward Roll.fbx`. Les commandes sont flèche haut/espace pour sauter et flèche bas pour rouler; les boutons tactiles sont affichés sous la scène. Les parties sont illimitées : seul le nouveau record personnel ajoute la différence au score total, une seule fois.

L'énigme 5 est une chasse aux cinq lettres du mot `BAGUE`. Les chemins QR sont définis dans `src/data/treasureClues.ts`; chaque page affiche uniquement sa lettre et le lien de retour au jeu. Dans l'administration (`/admin-2027`), saisir le domaine de production puis copier chaque URL pour générer les QR codes. Les URL sont accessibles sans inscription et les liens profonds sont réécrits vers l'application par la configuration Netlify.

## Administration

Ouvrir directement `/admin-2027` pour afficher la page organisateur. Le mot de passe provisoire est `mariage-admin-2027`, défini dans `src/features/AdminPage.tsx`; modifie-le avant de partager l’application. Pour chaque joueur, la page permet de remettre à zéro ses tentatives sur toutes les énigmes ou de le supprimer avec sa progression. Le reset global reste disponible; ces resets ne modifient ni les scores ni les réponses déjà validées.

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