export type Puzzle = {
  id: string
  title: string
  category: string
  prompt: string
  answer: string
  maxAttempts?: number
  image?: string
  images?: { src: string; alt: string; caption: string }[]
}

export const puzzles: Puzzle[] = [
  {
    id: '01',
    title: 'L’année des doubles',
    category: 'Énigme 01',
    prompt: 'En cette année particulière, la somme des âges de Léon et Romy sera deux fois plus petite que la somme des âges de Rémy et Karen. Mais quelle est cette année ?',
    answer: '2057',
  },
  {
    id: '02',
    title: 'Les molécules du bonheur',
    category: 'Énigme 02',
    prompt: `**Pour maintenir leur couple en parfaite santé, Karen et Rémy consomment chaque jour un cocktail naturel de 4 hormones du bonheur.**

Dans le laboratoire de Karen, chacune de ces 4 molécules a une fonction bien précise :

  1. *L'hormone de l'Amour et de la Tendresse* (libérée lors des câlins et du soutien mutuel).
  2. *La molécule du Plaisir et du Désir* (qui donne l'énergie de réaliser des projets à deux).
  3. *L'hormone de l'effort* (qui permet de bloquer la douleur physique et d'effacer la fatigue après le sport).
  4. *L'hormone de la Sérénité* (qui régule l'humeur et apporte la paix au quotidien).

  **Le défi :**
  Retrouvez le nom scientifique de ces 4 molécules.
  Prenez la *première lettre* de chacune et trouvez le mot indispensable en pharmacie (et dans l'amour) pour déverrouiller la suite !`,
    answer: 'DOSE',
  },
  {
    id: '03',
    title: "C'est pas du phoque",
    category: 'Énigme 03',
    prompt: `Déchiffrez ce message :

.- -. -. . . / .--. .-. . -- .. . .-. / -... .- .. ... . .-.`,
  answer: '2016',
  },
  {
    id: '04',
    title: 'A coté de ma voiture',
    category: 'Énigme 04',
    prompt: `*Dans la base de données de 'By My Car', Rémy doit sélectionner la voiture idéale pour le mariage. Mais avant de valider la commande, le système de Data Filtering doit éliminer les mauvais véhicules.*

Appliquez les filtres de Rémy pour éliminer les intrus et trouver la **seule et unique voiture** qui passe tous les tests :

- **Filtre 1 (Anti-Diesel) :** Rémy refuse catégoriquement les diesels. **Éliminez toutes les plaques qui contiennent la lettre 'D'.**
- **Filtre 2 (Éco-responsable) :** Karen veut un véhicule propre. **Éliminez les plaques qui contiennent le chiffre '0'.**
- **Filtre 3 (Boîte automatique) :** **Éliminez les plaques dont la somme totale des chiffres est supérieure ou égale à 15.**

**Voici le parc automobile du jour :**

- **Voiture A** : \`AB-123-CD\`
- **Voiture B** : \`XY-789-ZT\`
- **Voiture C** : \`LM-456-OP\`
- **Voiture D** : \`RS-309-WX\`
- **Voiture E** : \`JK-812-EF\`
- **Voiture F** : \`GH-555-MN\`

*Quelle est la lettre (A, B, C, D, E ou F) de la voiture gagnante ?*`,
    answer: 'E',
    maxAttempts: 1,
  },
  {
    id: '05',
    title: 'La chasse au trésor',
    category: 'Énigme 05',
    prompt: `Cinq QR codes sont cachés dans différents endroits. Retrouvez-les et scannez-les pour découvrir les cinq lettres.

Rassemblez les lettres, remettez-les dans le bon ordre et saisissez le mot qui se cache dans cette chasse au trésor !`,
    answer: 'BAGUE',
  },
  {
    id: '06',
    title: 'Le trajet de secours',
    category: 'Énigme 06',
    prompt: `**Au début de leur histoire, Rémy prenait le train depuis Grenoble pour rejoindre Karen à Lille. Mais ce week-end-là, la SNCF lui a joué un mauvais tour : la ligne directe Lyon - Paris - Lille est complètement coupée !**

En bon Data Analyst, Rémy dégaine immédiatement la carte du réseau ferroviaire de secours pour trouver une alternative.

**Les règles du voyage :**

- Chaque trajet entre deux villes a un coût représenté par la valeur de la flèche.
- Chaque arrêt dans une gare intermédiaire ajoute une pénalité de **+1** (attention : *le train traverse la gare de Pau sans s'y arrêter, cet arrêt ne coûte donc pas de pénalité*).
- Le sens des flèches doit impérativement être respecté !

**Le défi :**

- Trouvez l'itinéraire le plus court pour rallier **Grenoble à Lille** en respectant toutes les contraintes du réseau.
- Pour valider l'étape, entrez votre réponse sous la forme : **les premières lettres de chaque ville traversée (départ et arrivée compris), suivies du coût total du trajet** (par exemple : \`ABCDE10\`).`,
    answer: 'GMPBSL11',
    image: '/graph.jpg',
  },
  {
    id: '07',
    title: 'Les 5 différences',
    category: 'Énigme 07',
    prompt: `Cinq détails ont changé entre ces deux images. Repérez les différences, puis relevez les lettres qui ont été modifiées.

Remettez les lettres dans le bon ordre pour trouver le mot qui résume ce que l'on souhaite aux mariés.`,
    answer: 'VOEUX',
    images: [
      { src: '/5-differences-original.jpg', alt: 'Illustration originale du mariage', caption: 'Image de référence' },
      { src: '/5-differences-differences.jpg', alt: 'Illustration du mariage avec cinq différences', caption: 'Image modifiée' },
    ],
  },
]