/*
 * data-gaz.js
 * Base de données des raies spectrales visibles (380-750 nm) des gaz proposés.
 * Les longueurs d'onde sont des valeurs réelles (raies principales visibles,
 * issues de tables spectroscopiques usuelles : séries de Balmer pour H,
 * raies de He/Ne/Hg/Na/Ar/Kr des lampes à décharge basse pression).
 * "intensite" est une intensité RELATIVE (0 à 1) utilisée uniquement pour
 * l'épaisseur / luminosité d'affichage des raies, pas une valeur métrologique.
 */

const DataGaz = {

  gaz: [
    {
      id: 'H',
      nom: 'Hydrogène',
      symbole: 'H',
      description: "Série de Balmer : les 4 raies visibles correspondent aux transitions de l'électron vers le niveau n=2.",
      couleurGlobale: 'rgb(210, 90, 130)', // dominante rouge + touches bleu/violet -> rose-mauve
      raies: [
        { lambda: 656.3, intensite: 1.00, nom: 'H-alpha' },
        { lambda: 486.1, intensite: 0.55, nom: 'H-beta' },
        { lambda: 434.0, intensite: 0.35, nom: 'H-gamma' },
        { lambda: 410.2, intensite: 0.20, nom: 'H-delta' }
      ]
    },
    {
      id: 'He',
      nom: 'Hélium',
      symbole: 'He',
      description: "Découvert dans le spectre solaire en 1868 avant d'être isolé sur Terre. Raie jaune très intense (587,6 nm).",
      couleurGlobale: 'rgb(235, 200, 120)',
      raies: [
        { lambda: 667.8, intensite: 0.45 },
        { lambda: 587.6, intensite: 1.00, nom: 'Raie D3' },
        { lambda: 501.6, intensite: 0.40 },
        { lambda: 471.3, intensite: 0.30 },
        { lambda: 447.1, intensite: 0.55 },
        { lambda: 402.6, intensite: 0.25 }
      ]
    },
    {
      id: 'Ne',
      nom: 'Néon',
      symbole: 'Ne',
      description: "Très nombreuses raies rouge-orangé : c'est ce qui donne aux enseignes 'néon' leur couleur rouge caractéristique.",
      couleurGlobale: 'rgb(235, 90, 60)',
      raies: [
        { lambda: 585.2, intensite: 0.55 },
        { lambda: 614.3, intensite: 0.60 },
        { lambda: 616.4, intensite: 0.55 },
        { lambda: 621.7, intensite: 0.45 },
        { lambda: 638.3, intensite: 0.70 },
        { lambda: 640.2, intensite: 1.00 },
        { lambda: 659.9, intensite: 0.65 },
        { lambda: 692.9, intensite: 0.40 }
      ]
    },
    {
      id: 'Hg',
      nom: 'Mercure',
      symbole: 'Hg',
      description: "Dominante bleu-violet : c'est la lumière des anciens lampadaires 'lumière blafarde' bleutée.",
      couleurGlobale: 'rgb(150, 190, 235)',
      raies: [
        { lambda: 404.7, intensite: 0.45 },
        { lambda: 435.8, intensite: 1.00, nom: 'Raie bleue principale' },
        { lambda: 491.6, intensite: 0.15 },
        { lambda: 546.1, intensite: 0.75 },
        { lambda: 577.0, intensite: 0.35 },
        { lambda: 579.1, intensite: 0.35 }
      ]
    },
    {
      id: 'Na',
      nom: 'Sodium',
      symbole: 'Na',
      description: "Doublet jaune très intense (589,0 / 589,6 nm) : la couleur des anciens lampadaires urbains jaune-orangé.",
      couleurGlobale: 'rgb(240, 195, 70)',
      raies: [
        { lambda: 589.0, intensite: 1.00, nom: 'Raie D2' },
        { lambda: 589.6, intensite: 0.95, nom: 'Raie D1' }
      ]
    },
    {
      id: 'Ar',
      nom: 'Argon',
      symbole: 'Ar',
      description: "Mélange de raies violettes et de raies rouge/proche-infrarouge : donne la lueur lilas pâle typique des tubes à argon.",
      couleurGlobale: 'rgb(190, 150, 210)',
      raies: [
        { lambda: 415.9, intensite: 0.35 },
        { lambda: 419.8, intensite: 0.30 },
        { lambda: 696.5, intensite: 0.70 },
        { lambda: 706.7, intensite: 0.55 },
        { lambda: 727.3, intensite: 0.40 },
        { lambda: 738.4, intensite: 0.50 },
        { lambda: 750.4, intensite: 0.35 }
      ]
    },
    {
      id: 'Kr',
      nom: 'Krypton',
      symbole: 'Kr',
      description: "Mélange de raies violettes/bleues et jaune/orangé : lueur blanche légèrement verdâtre, utilisée dans certains flashs photo.",
      couleurGlobale: 'rgb(215, 225, 210)',
      raies: [
        { lambda: 431.96, intensite: 0.45 },
        { lambda: 436.26, intensite: 0.45 },
        { lambda: 445.39, intensite: 0.35 },
        { lambda: 587.09, intensite: 0.65 },
        { lambda: 599.39, intensite: 0.55 },
        { lambda: 636.35, intensite: 0.30 }
      ]
    }
  ],

  /** Recherche un gaz par son identifiant (ex: 'H', 'He'...) */
  parId(id) {
    return this.gaz.find(g => g.id === id) || null;
  }
};
