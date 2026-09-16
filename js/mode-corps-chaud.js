/*
 * mode-corps-chaud.js
 * Interaction du mode "Corps chaud" : curseur de température relié à la
 * loi de Planck et à la loi de déplacement de Wien.
 */

const ModeCorpsChaud = {

  init() {
    this.curseur = document.getElementById('curseur-temperature');
    this.orbe = document.getElementById('orbe-corps');
    this.lectureTemperature = document.getElementById('lecture-temperature');
    this.lectureCouleur = document.getElementById('lecture-couleur');
    this.lecturePic = document.getElementById('lecture-pic');
    this.canvas = document.getElementById('canvas-spectre-corps');

    this.curseur.addEventListener('input', () => this.mettreAJour());
    window.addEventListener('resize', () => this.mettreAJour());
    this.mettreAJour();
  },

  mettreAJour() {
    const T = Number(this.curseur.value);
    const couleur = PhysiqueCorpsChaud.couleurDuCorps(T);
    const css = `rgb(${couleur.r}, ${couleur.g}, ${couleur.b})`;

    this.orbe.style.background =
      `radial-gradient(circle at 35% 30%, ${this._eclaircir(couleur, 0.5)}, ${css} 60%, ${this._assombrir(couleur, 0.6)})`;
    this.orbe.style.boxShadow = `0 0 70px 14px ${CouleurUtils.rgbToCss(couleur, 0.5)}`;

    this.lectureTemperature.textContent = `${T.toLocaleString('fr-FR')} K`;
    this.lectureCouleur.textContent = PhysiqueCorpsChaud.descriptionCouleur(T);
    const pic = PhysiqueCorpsChaud.longueurDondePic(T);
    this.lecturePic.textContent = pic < 380
      ? `${pic.toFixed(0)} nm (ultraviolet, hors du visible)`
      : pic > 780
        ? `${pic.toFixed(0)} nm (infrarouge, hors du visible)`
        : `${pic.toFixed(0)} nm`;

    this._dessinerSpectre(T);
  },

  _dessinerSpectre(T) {
    const { ctx, largeur, hauteur } = SceneOptique.ajusterResolution(this.canvas);
    ctx.clearRect(0, 0, largeur, hauteur);
    ctx.fillStyle = '#050506';
    ctx.fillRect(0, 0, largeur, hauteur);

    const points = PhysiqueCorpsChaud.echantillonsSpectre(T, Math.max(60, Math.floor(largeur / 4)));
    const baseline = hauteur - 6;
    const sommetMax = hauteur * 0.08;

    points.forEach((p, i) => {
      const x = (i / (points.length - 1)) * largeur;
      const largeurBande = largeur / points.length + 1;
      const rgb = CouleurUtils.longueurDondeVersRGB(p.lambda);
      const hBande = sommetMax + p.intensite * (baseline - sommetMax - (baseline - sommetMax));
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
