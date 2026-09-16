/*
 * scene-optique.js
 * Dessin canvas partagé entre le mode "Spectre de raies" et le mode
 * "Identifier un gaz" : banc optique schématique (fente / prisme / écran)
 * et affichage "à plat" du spectre (utilisé aussi dans la fenêtre modale).
 *
 * Simplification pédagogique assumée : la dispersion du prisme est
 * représentée par une correspondance LINÉAIRE longueur d'onde <-> position
 * horizontale (un vrai prisme disperse de façon non linéaire, plus fort
 * dans le bleu). Cela garde le schéma lisible sans fausser les couleurs
 * ni l'ordre des raies, qui eux sont physiquement corrects.
 */

const SceneOptique = {

  LAMBDA_MIN: 380,
  LAMBDA_MAX: 750,

  /** Adapte la résolution interne du canvas à sa taille CSS réelle (netteté). */
  ajusterResolution(canvas) {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = Math.round(rect.width * dpr);
    const h = Math.round(rect.height * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, largeur: rect.width, hauteur: rect.height };
  },

  lambdaVersX(lambda, xMin, xMax) {
    const t = (lambda - this.LAMBDA_MIN) / (this.LAMBDA_MAX - this.LAMBDA_MIN);
    return xMin + t * (xMax - xMin);
  },

  /** Couleur globale (approx.) d'un ensemble de raies, pour teinter une lueur. */
  couleurGlobaleRaies(raies) {
    const couleurs = raies.map(r => CouleurUtils.longueurDondeVersRGB(r.lambda));
    return CouleurUtils.melangerCouleurs(couleurs);
  },

  // ------------------------------------------------------------------
  // Spectre "à plat", vu de face (utilisé dans le panneau et la modale)
  // ------------------------------------------------------------------

  /**
   * raiesGroupes : tableau de { raies: [{lambda,intensite}], teinte: '#rrggbb' (optionnel, pour distinguer 2 gaz superposés) }
   * mode: 'emission' ou 'absorption'
   */
  dessinerSpectrePlat(ctx, largeur, hauteur, raiesGroupes, mode) {
    ctx.clearRect(0, 0, largeur, hauteur);
    const marge = 10;
    const xMin = marge, xMax = largeur - marge;
    const yMin = marge, yMax = hauteur - marge;

    if (mode === 'absorption') {
      // Fond continu (spectre blanc décomposé), puis on assombrit aux
      // longueurs d'onde absorbées par chaque gaz du groupe.
      const step = 1;
      for (let x = xMin; x <= xMax; x += step) {
        const t = (x - xMin) / (xMax - xMin);
        const lambda = this.LAMBDA_MIN + t * (this.LAMBDA_MAX - this.LAMBDA_MIN);
        const rgb = CouleurUtils.longueurDondeVersRGB(lambda);
        let attenuation = 1;
        raiesGroupes.forEach(groupe => {
          groupe.raies.forEach(r => {
            const dx = Math.abs(lambda - r.lambda);
            const largeurRaie = 2.4;
            if (dx < largeurRaie * 3) {
              const creux = r.intensite * Math.exp(-(dx * dx) / (2 * largeurRaie * largeurRaie));
              attenuation *= (1 - 0.92 * creux);
            }
          });
        });
        ctx.fillStyle = `rgb(${Math.round(rgb.r * attenuation)}, ${Math.round(rgb.g * attenuation)}, ${Math.round(rgb.b * attenuation)})`;
        ctx.fillRect(x, yMin, step + 1, yMax - yMin);
      }
    } else {
      // Fond noir, raies d'émission lumineuses
      ctx.fillStyle = '#050506';
      ctx.fillRect(xMin, yMin, xMax - xMin, yMax - yMin);

      raiesGroupes.forEach(groupe => {
        groupe.raies.forEach(r => {
          const x = this.lambdaVersX(r.lambda, xMin, xMax);
          const rgb = CouleurUtils.longueurDondeVersRGB(r.lambda);
          const largeurTrait = 2 + r.intensite * 3;
          const grad = ctx.createLinearGradient(x - 10, 0, x + 10, 0);
          const c = `rgb(${rgb.r},${rgb.g},${rgb.b})`;
          grad.addColorStop(0, 'rgba(0,0,0,0)');
          grad.addColorStop(0.5, c);
          grad.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = grad;
          ctx.fillRect(x - 10, yMin, 20, yMax - yMin);
          ctx.fillStyle = c;
          ctx.fillRect(x - largeurTrait / 2, yMin, largeurTrait, yMax - yMin);
        });
      });
    }
  },

  // ------------------------------------------------------------------
  // Banc optique schématique (fente, prisme, écran) avec effet de profondeur
  // ------------------------------------------------------------------

  /**
   * state = {
   *   type: 'emission' | 'absorption',
   *   gazEmission: objet gaz (data-gaz) ou null   -- utilisé si type==='emission'
   *   gazAbsorption: objet gaz ou null              -- utilisé si type==='absorption'
   *   sourceAllumee: bool                           -- interrupteur de la lampe (absorption)
   *   survolZone: 'source' | 'absorption' | null    -- pour surligner la zone survolée en drag
   *   inconnu: bool -- si true, le gaz déposé est affiché "générique" (mode identification)
   * }
   */
  dessinerBanc(canvas, state) {
    const { ctx, largeur, hauteur } = this.ajusterResolution(canvas);
    ctx.clearRect(0, 0, largeur, hauteur);

    const yMid = hauteur * 0.42;
    const xSource = largeur * 0.10;
    const xFente = largeur * 0.30;
    const xAbsorption = largeur * 0.46;
    const xPrisme = largeur * 0.62;
    const xEcran = largeur * 0.94;

    // ---- Zones de dépôt (halo pointillé) ----
    this._dessinerZoneDepot(ctx, xSource, yMid, state.survolZone === 'source' && state.type === 'emission');
    if (state.type === 'absorption') {
      this._dessinerZoneDepot(ctx, xAbsorption, yMid, state.survolZone === 'absorption');
    }

    // ---- Source ----
    let couleurFaisceauEntree; // couleur du trait avant le prisme
    let raiesActives = null;   // raies à décomposer après le prisme (emission)
    let estContinu = false;    // vrai si un faisceau blanc continu circule (absorption, lampe allumée)

    if (state.type === 'emission') {
      const gaz = state.gazEmission;
      if (gaz) {
        const couleur = this.couleurGlobaleRaies(gaz.raies);
        this._dessinerTubeGaz(ctx, xSource, yMid, couleur, state.inconnu);
        couleurFaisceauEntree = couleur;
        raiesActives = gaz.raies;
      } else {
        this._dessinerSupportVide(ctx, xSource, yMid, 'Glisse un gaz ici');
      }
    } else {
      this._dessinerLampe(ctx, xSource, yMid, state.sourceAllumee);
      if (state.sourceAllumee) {
        couleurFaisceauEntree = { r: 255, g: 250, b: 240 };
        estContinu = true;
      }
      const gaz = state.gazAbsorption;
      if (gaz) {
        this._dessinerCuveGaz(ctx, xAbsorption, yMid, this.couleurGlobaleRaies(gaz.raies), state.inconnu);
        raiesActives = gaz.raies; // servira à creuser le faisceau continu
      } else {
        this._dessinerSupportVide(ctx, xAbsorption, yMid, 'Dépose le gaz ici');
      }
    }

    // ---- Fente ----
    this._dessinerFente(ctx, xFente, yMid, hauteur);

    // ---- Faisceau avant le prisme ----
    if (couleurFaisceauEntree) {
      if (estContinu) {
        this._dessinerFaisceauContinu(ctx, xSource + 30, xPrisme, yMid);
      } else {
        this._dessinerTrait(ctx, xSource + 26, xPrisme, yMid, couleurFaisceauEntree, 3);
      }
    }

    // ---- Prisme ----
    this._dessinerPrisme(ctx, xPrisme, yMid, hauteur);

    // ---- Écran / mur ----
    this._dessinerEcran(ctx, xEcran, hauteur);

    // ---- Faisceau décomposé après le prisme ----
    if (state.type === 'emission' && raiesActives) {
      this._dessinerEventailRaies(ctx, xPrisme, xEcran, yMid, hauteur, raiesActives, true);
    } else if (state.type === 'absorption' && estContinu) {
      this._dessinerEventailContinu(ctx, xPrisme, xEcran, yMid, hauteur, raiesActives);
    }
  },

  _dessinerZoneDepot(ctx, x, y, survole) {
    ctx.save();
    ctx.strokeStyle = survole ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.16)';
    ctx.setLineDash([5, 5]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 36, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  },

  _dessinerSupportVide(ctx, x, y, texte) {
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font = '11px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(texte, x, y + 58);
    ctx.restore();
  },

  _dessinerTubeGaz(ctx, x, y, couleur, inconnu) {
    const c = inconnu ? { r: 190, g: 190, b: 196 } : couleur;
    const css = `rgb(${c.r},${c.g},${c.b})`;
    ctx.save();
    // lueur
    const grad = ctx.createRadialGradient(x, y, 2, x, y, 34);
    grad.addColorStop(0, CouleurUtils.rgbToCss(c, 0.9));
    grad.addColorStop(1, CouleurUtils.rgbToCss(c, 0));
    ctx.fillStyle = grad;
    ctx.fillRect(x - 34, y - 34, 68, 68);
    // tube
    ctx.fillStyle = '#26282c';
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1.5;
    roundRect(ctx, x - 10, y - 24, 20, 48, 8);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = css;
    roundRect(ctx, x - 6, y - 18, 12, 36, 5);
    ctx.fill();
    if (inconnu) {
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      ctx.font = 'bold 12px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('?', x, y + 46);
    }
    ctx.restore();
  },

  _dessinerCuveGaz(ctx, x, y, couleur, inconnu) {
    const c = inconnu ? { r: 190, g: 190, b: 196 } : couleur;
    const css = `rgb(${c.r},${c.g},${c.b})`;
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1.5;
    roundRect(ctx, x - 16, y - 30, 32, 60, 6);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = CouleurUtils.rgbToCss(c, 0.5);
    ctx.fillRect(x - 14, y - 10, 28, 38);
    ctx.restore();
  },

  _dessinerLampe(ctx, x, y, allumee) {
    ctx.save();
    if (allumee) {
      const grad = ctx.createRadialGradient(x, y, 2, x, y, 40);
      grad.addColorStop(0, 'rgba(255,250,235,0.9)');
      grad.addColorStop(1, 'rgba(255,250,235,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(x - 40, y - 40, 80, 80);
    }
    ctx.beginPath();
    ctx.arc(x, y, 16, 0, Math.PI * 2);
    ctx.fillStyle = allumee ? '#fff8e6' : '#3a3b3f';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.stroke();
    ctx.fillStyle = allumee ? '#e3c26e' : '#55565b';
    ctx.beginPath();
    ctx.moveTo(x, y + 16);
    ctx.lineTo(x - 8, y + 30);
    ctx.lineTo(x + 8, y + 30);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  },

  _dessinerFente(ctx, x, y, hauteurCanvas) {
    ctx.save();
    ctx.fillStyle = '#2a2c30';
    ctx.fillRect(x - 6, hauteurCanvas * 0.08, 12, hauteurCanvas * 0.8);
    ctx.clearRect(x - 6, y - 10, 12, 20);
    ctx.fillStyle = '#050506';
    ctx.fillRect(x - 6, y - 10, 12, 20);
    ctx.restore();
  },

  _dessinerPrisme(ctx, x, y, hauteurCanvas) {
    const taille = hauteurCanvas * 0.22;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x - taille * 0.55, y + taille * 0.5);
    ctx.lineTo(x + taille * 0.55, y + taille * 0.5);
    ctx.lineTo(x, y - taille * 0.6);
    ctx.closePath();
    const grad = ctx.createLinearGradient(x - taille / 2, y, x + taille / 2, y);
    grad.addColorStop(0, 'rgba(180,200,220,0.18)');
    grad.addColorStop(0.5, 'rgba(220,230,240,0.30)');
    grad.addColorStop(1, 'rgba(180,200,220,0.18)');
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  },

  _dessinerEcran(ctx, x, hauteurCanvas) {
    ctx.save();
    ctx.fillStyle = '#1b1c20';
    ctx.fillRect(x, hauteurCanvas * 0.06, hauteurCanvas * 0.02 + 4, hauteurCanvas * 0.88);
    ctx.restore();
  },

  _dessinerTrait(ctx, x1, x2, y, couleur, epaisseur) {
    ctx.save();
    ctx.strokeStyle = CouleurUtils.rgbToCss(couleur, 0.9);
    ctx.shadowColor = CouleurUtils.rgbToCss(couleur, 0.8);
    ctx.shadowBlur = 8;
    ctx.lineWidth = epaisseur;
    ctx.beginPath();
    ctx.moveTo(x1, y);
    ctx.lineTo(x2, y);
    ctx.stroke();
    ctx.restore();
  },

  _dessinerFaisceauContinu(ctx, x1, x2, y) {
    ctx.save();
    const grad = ctx.createLinearGradient(x1, 0, x2, 0);
    grad.addColorStop(0, 'rgba(255,250,235,0.9)');
    grad.addColorStop(1, 'rgba(255,250,235,0.9)');
    ctx.strokeStyle = grad;
    ctx.shadowColor = 'rgba(255,250,235,0.6)';
    ctx.shadowBlur = 8;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x1, y);
    ctx.lineTo(x2, y);
    ctx.stroke();
    ctx.restore();
  },

  /**
   * Éventail de raies discrètes du prisme vers l'écran, avec un léger
   * décalage vertical progressif par raie pour donner une impression de
   * profondeur (vue légèrement de côté), comme demandé.
   */
  _dessinerEventailRaies(ctx, xPrisme, xEcran, yMid, hauteurCanvas, raies, avecImpact) {
    const yHautEventail = hauteurCanvas * 0.14;
    const yBasEventail = hauteurCanvas * 0.82;
    raies.forEach((r, i) => {
      const t = (r.lambda - this.LAMBDA_MIN) / (this.LAMBDA_MAX - this.LAMBDA_MIN);
      // violet dévié plus fort (vers le haut), rouge moins dévié (vers le bas)
      const yImpact = yBasEventail - t * (yBasEventail - yHautEventail);
      const rgb = CouleurUtils.longueurDondeVersRGB(r.lambda);
      const decalageProfondeur = i * 1.4; // ruban de profondeur
      ctx.save();
      ctx.strokeStyle = CouleurUtils.rgbToCss(rgb, 0.55 + 0.4 * r.intensite);
      ctx.shadowColor = CouleurUtils.rgbToCss(rgb, 0.6);
      ctx.shadowBlur = 6;
      ctx.lineWidth = 1.4 + r.intensite * 1.8;
      ctx.beginPath();
      ctx.moveTo(xPrisme + 4, yMid);
      ctx.lineTo(xEcran - 2, yImpact + decalageProfondeur * 0.15);
      ctx.stroke();
      ctx.restore();
      if (avecImpact) {
        ctx.save();
        ctx.fillStyle = CouleurUtils.rgbToCss(rgb, 0.85);
        ctx.shadowColor = CouleurUtils.rgbToCss(rgb, 0.9);
        ctx.shadowBlur = 8;
        const h = 4 + r.intensite * 10;
        ctx.fillRect(xEcran - 3, yImpact - h / 2, 8, h);
        ctx.restore();
      }
    });
  },

  /** Éventail continu (arc-en-ciel) du prisme vers l'écran, creusé si des raies d'absorption sont fournies. */
  _dessinerEventailContinu(ctx, xPrisme, xEcran, yMid, hauteurCanvas, raiesAbsorbees) {
    const yHaut = hauteurCanvas * 0.14;
    const yBas = hauteurCanvas * 0.82;
    const nb = 90;
    for (let i = 0; i < nb; i++) {
      const t = i / (nb - 1);
      const lambda = this.LAMBDA_MIN + t * (this.LAMBDA_MAX - this.LAMBDA_MIN);
      const yImpact = yBas - t * (yBas - yHaut);
      const rgb = CouleurUtils.longueurDondeVersRGB(lambda);
      let attenuation = 1;
      if (raiesAbsorbees) {
        raiesAbsorbees.forEach(r => {
          const dx = Math.abs(lambda - r.lambda);
          const largeurRaie = 3;
          if (dx < largeurRaie * 3) {
            const creux = r.intensite * Math.exp(-(dx * dx) / (2 * largeurRaie * largeurRaie));
            attenuation *= (1 - 0.92 * creux);
          }
        });
      }
      const c = { r: rgb.r * attenuation, g: rgb.g * attenuation, b: rgb.b * attenuation };
      ctx.save();
      ctx.strokeStyle = `rgba(${c.r},${c.g},${c.b},${0.35 * attenuation + 0.1})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(xPrisme + 4, yMid);
      ctx.lineTo(xEcran - 2, yImpact);
      ctx.stroke();
      ctx.restore();
      ctx.save();
      ctx.fillStyle = `rgb(${c.r},${c.g},${c.b})`;
      ctx.fillRect(xEcran - 3, yImpact - 2, 8, 4);
      ctx.restore();
    }
  }
};

/** Petit utilitaire : rectangle à coins arrondis (non fourni nativement partout). */
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
