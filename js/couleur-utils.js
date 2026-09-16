/*
 * couleur-utils.js
 * Fonctions de colorimétrie physique réutilisées par tous les modes.
 */

const CouleurUtils = {

  /**
   * Convertit une longueur d'onde visible (en nm, 380-750) en couleur RGB
   * approximative perçue par l'œil humain.
   * Algorithme classique (d'après Dan Bruton, "Approximate RGB values for
   * Visible Wavelengths", 1996), largement utilisé en pédagogie de l'optique.
   * Retourne {r,g,b} entiers 0-255.
   */
  longueurDondeVersRGB(lambda) {
    let r = 0, g = 0, b = 0;
    let facteur = 1;

    if (lambda >= 380 && lambda < 440) {
      r = -(lambda - 440) / (440 - 380);
      g = 0; b = 1;
    } else if (lambda >= 440 && lambda < 490) {
      r = 0;
      g = (lambda - 440) / (490 - 440);
      b = 1;
    } else if (lambda >= 490 && lambda < 510) {
      r = 0; g = 1;
      b = -(lambda - 510) / (510 - 490);
    } else if (lambda >= 510 && lambda < 580) {
      r = (lambda - 510) / (580 - 510);
      g = 1; b = 0;
    } else if (lambda >= 580 && lambda < 645) {
      r = 1;
      g = -(lambda - 645) / (645 - 580);
      b = 0;
    } else if (lambda >= 645 && lambda <= 750) {
      r = 1; g = 0; b = 0;
    }

    // Atténuation aux bords du spectre visible (l'œil est moins sensible)
    if (lambda >= 380 && lambda < 420) {
      facteur = 0.3 + 0.7 * (lambda - 380) / (420 - 380);
    } else if (lambda >= 420 && lambda < 701) {
      facteur = 1.0;
    } else if (lambda >= 701 && lambda <= 750) {
      facteur = 0.3 + 0.7 * (750 - lambda) / (750 - 700);
    } else {
      facteur = 0; // hors visible
    }

    const gamma = 0.8;
    const adapte = (c) => c <= 0 ? 0 : Math.round(255 * Math.pow(c * facteur, gamma));
    return { r: adapte(r), g: adapte(g), b: adapte(b) };
  },

  rgbToCss({ r, g, b }, alpha) {
    if (alpha === undefined) return `rgb(${r}, ${g}, ${b})`;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  },

  melangerCouleurs(couleurs) {
    // Mélange additif simple (moyenne) de plusieurs {r,g,b}, utile pour
    // représenter la teinte globale d'un tube contenant plusieurs raies.
    const n = couleurs.length;
    const somme = couleurs.reduce((acc, c) => ({
      r: acc.r + c.r, g: acc.g + c.g, b: acc.b + c.b
    }), { r: 0, g: 0, b: 0 });
    return { r: Math.round(somme.r / n), g: Math.round(somme.g / n), b: Math.round(somme.b / n) };
  },

  // ---------------------------------------------------------------
  // Colorimétrie CIE 1931 pour le mode "Corps Chaud"
  // ---------------------------------------------------------------

  /**
   * Approximation analytique multi-gaussienne des fonctions colorimétriques
   * CIE 1931 (x̄, ȳ, z̄), d'après Wyman, Sloan & Shirley,
   * "Simple Analytic Approximations to the CIE XYZ Color Matching Functions"
   * (Journal of Computer Graphics Techniques, 2013).
   * lambda en nanomètres. Retourne {x, y, z}.
   */
  cieMatchingFunctions(lambda) {
    const g = (x, mu, s1, s2) => {
      const s = x < mu ? s1 : s2;
      const t = (x - mu) / s;
      return Math.exp(-0.5 * t * t);
    };
    const x = 1.056 * g(lambda, 599.8, 37.9, 31.0)
            + 0.362 * g(lambda, 442.0, 16.0, 26.7)
            - 0.065 * g(lambda, 501.1, 20.4, 26.2);
    const y = 0.821 * g(lambda, 568.8, 46.9, 40.5)
            + 0.286 * g(lambda, 530.9, 16.3, 31.1);
    const z = 1.217 * g(lambda, 437.0, 11.8, 36.0)
            + 0.681 * g(lambda, 459.0, 26.0, 13.8);
    return { x, y, z };
  },

  /**
   * Conversion XYZ (CIE) -> sRGB. On ne cherche pas ici une luminance
   * absolue (qui varierait sur des ordres de grandeur avec la température)
   * mais la TEINTE (chrominance) du corps noir, affichée à luminosité
   * maximale : c'est la convention standard des "cartes de couleur du
   * corps noir" (Planckian locus charts).
   */
  xyzVersSRGB(X, Y, Z) {
    // Matrice standard XYZ -> linear sRGB (D65)
    let r =  3.2406 * X - 1.5372 * Y - 0.4986 * Z;
    let g = -0.9689 * X + 1.8758 * Y + 0.0415 * Z;
    let b =  0.0557 * X - 0.2040 * Y + 1.0570 * Z;

    // On élimine les composantes négatives (couleurs hors gamut sRGB)
    r = Math.max(0, r); g = Math.max(0, g); b = Math.max(0, b);

    // On ramène la composante la plus forte à 1 : on affiche la teinte
    // à pleine luminosité plutôt que la luminance physique réelle.
    const maxC = Math.max(r, g, b, 1e-6);
    r /= maxC; g /= maxC; b /= maxC;

    const gammaCorrige = (c) => c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
    r = gammaCorrige(r); g = gammaCorrige(g); b = gammaCorrige(b);

    const clamp255 = (c) => Math.round(Math.min(1, Math.max(0, c)) * 255);
    return { r: clamp255(r), g: clamp255(g), b: clamp255(b) };
  }
};
