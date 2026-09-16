/*
 * physique-corps-chaud.js
 * Loi de Planck + loi de Wien pour le mode "Corps Chaud".
 */

const PhysiqueCorpsChaud = {

  // Constantes physiques (SI)
  h: 6.62607015e-34,   // constante de Planck (J.s)
  c: 2.99792458e8,      // vitesse de la lumière (m/s)
  k: 1.380649e-23,       // constante de Boltzmann (J/K)
  bWien: 2.8977719e-3,   // constante de la loi de Wien (m.K)

  LAMBDA_MIN: 380,  // nm
  LAMBDA_MAX: 780,  // nm

  /**
   * Loi de Planck : luminance spectrale énergétique B(lambda, T).
   * lambdaNm en nanomètres, T en kelvins.
   * Retourne B en W.sr^-1.m^-3 (valeur non normalisée).
   */
  loiDePlanck(lambdaNm, T) {
    const lambda = lambdaNm * 1e-9;
    const { h, c, k } = this;
    const terme1 = (2 * h * c * c) / Math.pow(lambda, 5);
    const exposant = (h * c) / (lambda * k * T);
    // Se protéger d'un exposant énorme (T très bas) -> exp explose -> B ~ 0
    if (exposant > 700) return 0;
    const terme2 = 1 / (Math.exp(exposant) - 1);
    return terme1 * terme2;
  },

  /** Loi de déplacement de Wien : longueur d'onde du pic d'émission (nm). */
  longueurDondePic(T) {
    return (this.bWien / T) * 1e9;
  },

  /**
   * Calcule la couleur perçue (sRGB) d'un corps noir à la température T,
   * en intégrant la loi de Planck pondérée par les fonctions colorimétriques
   * CIE 1931 sur le spectre visible (380-780 nm).
   */
  couleurDuCorps(T) {
    let X = 0, Y = 0, Z = 0;
    const pas = 5; // nm
    for (let lambda = this.LAMBDA_MIN; lambda <= this.LAMBDA_MAX; lambda += pas) {
      const B = this.loiDePlanck(lambda, T);
      const cmf = CouleurUtils.cieMatchingFunctions(lambda);
      X += B * cmf.x * pas;
      Y += B * cmf.y * pas;
      Z += B * cmf.z * pas;
    }
    // Normalisation par Y pour ne garder que la chrominance (pas la luminance
    // absolue, qui varierait de plusieurs ordres de grandeur avec T).
    if (Y === 0) return { r: 40, g: 10, b: 10 };
    const k = 1 / Y;
    return CouleurUtils.xyzVersSRGB(X * k, 1, Z * k);
  },

  /**
   * Renvoie un échantillonnage du spectre continu visible pour un affichage
   * graphique, normalisé à 1 sur son propre maximum (on représente ainsi
   * fidèlement la FORME du spectre - quelles longueurs d'onde sont bien
   * représentées ou non - plutôt que la luminance absolue, qui varie sur
   * plusieurs ordres de grandeur entre 1000K et 20000K).
   */
  echantillonsSpectre(T, nbPoints) {
    const points = [];
    const span = this.LAMBDA_MAX - this.LAMBDA_MIN;
    for (let i = 0; i < nbPoints; i++) {
      const lambda = this.LAMBDA_MIN + (span * i) / (nbPoints - 1);
      points.push({ lambda, valeur: this.loiDePlanck(lambda, T) });
    }
    const maxVal = Math.max(...points.map(p => p.valeur), 1e-30);
    points.forEach(p => { p.intensite = p.valeur / maxVal; });
    return points;
  },

  /** Description qualitative de la couleur pour un texte pédagogique. */
  descriptionCouleur(T) {
    if (T < 1700) return 'rouge sombre';
    if (T < 2200) return 'rouge-orangé (braise)';
    if (T < 3200) return 'orangé (filament de lampe à incandescence)';
    if (T < 4500) return 'blanc chaud jaunâtre';
    if (T < 6000) return 'blanc (proche de la lumière du jour)';
    if (T < 9000) return 'blanc légèrement bleuté';
    return 'bleu-blanc (étoile chaude)';
  }
};
