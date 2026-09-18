/*
 * mode-corps-chaud.js
 * Interaction du mode "Corps chaud" : curseur de température relié à la
 * loi de Planck et à la loi de déplacement de Wien. Le pic d'émission
 * (loi de Wien) est matérialisé directement sur le graphique par un axe
 * vertical mobile plutôt que par un texte séparé.
 */

const ModeCorpsChaud = {

  init() {
    this.curseur = document.getElementById('curseur-temperature');
    this.orbe = document.getElementById('orbe-corps');
    this.lectureTemperature = document.getElementById('lecture-temperature');
    this.lectureComparaison = document.getElementById('lecture-comparaison');
    this.canvas = document.getElementById('canvas-spectre-corps');

    this.curseur.addEventListener('input', () => this.mettreAJour());
    SceneOptique.observerTaille(this.canvas, () => this.mettreAJour());
  },

  mettreAJour() {
    const T = Number(this.curseur.value);
    const couleur = PhysiqueCorpsChaud.couleurDuCorps(T);
    const css = `rgb(${couleur.r}, ${couleur.g}, ${couleur.b})`;

    this.orbe.style.background =
      `radial-gradient(circle at 35% 30%, ${this._eclaircir(couleur, 0.5)}, ${css} 60%, ${this._assombrir(couleur, 0.6)})`;
    this.orbe.style.boxShadow = `0 0 70px 14px ${CouleurUtils.rgbToCss(couleur, 0.5)}`;

    this.lectureTemperature.textContent = `${T.toLocaleString('fr-FR')} K`;
    this.lectureComparaison.textContent = PhysiqueCorpsChaud.comparaisonObjet(T);

    this._dessinerSpectre(T, couleur);
  },

  _dessinerSpectre(T, couleur) {
    const { ctx, largeur, hauteur } = SceneOptique.ajusterResolution(this.canvas);
    ctx.clearRect(0, 0, largeur, hauteur);
    ctx.fillStyle = '#050506';
    ctx.fillRect(0, 0, largeur, hauteur);

    const points = PhysiqueCorpsChaud.echantillonsSpectre(T, Math.max(60, Math.floor(largeur / 4)));
    // On réserve de la place en bas du graphique pour le label du pic (en nm).
    const baseline = hauteur - 22;
    const sommetMax = hauteur * 0.08;

    points.forEach((p, i) => {
      const x = (i / (points.length - 1)) * largeur;
      const largeurBande = largeur / points.length + 1;
      const rgb = CouleurUtils.longueurDondeVersRGB(p.lambda);
      const hauteurTrait = p.intensite * (baseline - sommetMax);
      ctx.fillStyle = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
      ctx.globalAlpha = 0.35 + 0.65 * p.intensite;
      ctx.fillRect(x, baseline - hauteurTrait, largeurBande, hauteurTrait);
    });
    ctx.globalAlpha = 1;

    // Ligne de contour de la courbe pour la lisibilité
    ctx.beginPath();
    points.forEach((p, i) => {
      const x = (i / (points.length - 1)) * largeur;
      const y = baseline - p.intensite * (baseline - sommetMax);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    this._dessinerAxePic(ctx, T, couleur, largeur, hauteur, baseline);
  },

  /**
   * Axe vertical mobile qui suit le pic d'émission (loi de Wien). Le label
   * en pied d'axe prend la couleur perçue du corps chaud à cette
   * température (et non la couleur de la raie à cet endroit du spectre).
   */
  _dessinerAxePic(ctx, T, couleur, largeur, hauteur, baseline) {
    const pic = PhysiqueCorpsChaud.longueurDondePic(T);
    const { LAMBDA_MIN, LAMBDA_MAX } = PhysiqueCorpsChaud;
    const xBrut = ((pic - LAMBDA_MIN) / (LAMBDA_MAX - LAMBDA_MIN)) * largeur;
    // Si le pic sort du visible (IR à basse T, UV à haute T), l'axe se
    // colle contre le bord correspondant du spectre affiché.
    const xPic = Math.min(largeur - 2, Math.max(2, xBrut));
    const couleurTexte = `rgb(${couleur.r}, ${couleur.g}, ${couleur.b})`;

    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(xPic, 6);
    ctx.lineTo(xPic, baseline + 4);
    ctx.stroke();
    ctx.setLineDash([]);

    // petite pointe de repère en haut de l'axe
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.moveTo(xPic - 4, 6);
    ctx.lineTo(xPic + 4, 6);
    ctx.lineTo(xPic, 12);
    ctx.closePath();
    ctx.fill();

    // Label en pied d'axe (couleur du corps chaud, pas de la raie)
    ctx.fillStyle = couleurTexte;
    ctx.font = 'bold 11px -apple-system, sans-serif';
    ctx.textAlign = xPic < largeur * 0.15 ? 'left' : xPic > largeur * 0.85 ? 'right' : 'center';
    const decalage = ctx.textAlign === 'left' ? 4 : ctx.textAlign === 'right' ? -4 : 0;
    ctx.fillText(`${pic.toFixed(0)} nm`, xPic + decalage, hauteur - 6);
    ctx.restore();
  },

  _eclaircir(c, k) {
    const f = (v) => Math.round(v + (255 - v) * k);
    return `rgb(${f(c.r)}, ${f(c.g)}, ${f(c.b)})`;
  },
  _assombrir(c, k) {
    const f = (v) => Math.round(v * (1 - k));
    return `rgb(${f(c.r)}, ${f(c.g)}, ${f(c.b)})`;
  }
};
