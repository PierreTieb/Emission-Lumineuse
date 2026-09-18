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

  /**
   * Adapte la résolution interne du canvas à sa taille CSS réelle (netteté).
   * IMPORTANT : si l'élément est actuellement caché (écran non affiché),
   * getBoundingClientRect renvoie 0x0. Il ne faut alors surtout PAS écraser
   * les attributs width/height du canvas avec 0 : cela détruirait son ratio
   * intrinsèque utilisé par le CSS (aspect-ratio / height:auto) et la
   * miniature resterait cassée même une fois l'écran affiché. On se
   * contente donc de ne rien redimensionner tant qu'on n'a pas une taille
   * réelle exploitable.
   */
  ajusterResolution(canvas) {
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    if (rect.width < 2 || rect.height < 2) {
      return { ctx, largeur: canvas.width, hauteur: canvas.height, pretAffichage: false };
    }
    const dpr = window.devicePixelRatio || 1;
    const w = Math.round(rect.width * dpr);
    const h = Math.round(rect.height * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, largeur: rect.width, hauteur: rect.height, pretAffichage: true };
  },

  /**
   * Redessine automatiquement un canvas dès que sa taille réelle change,
   * y compris lors du passage caché -> affiché (changement d'écran), d'un
   * redimensionnement de fenêtre ou d'une rotation d'écran. Beaucoup plus
   * fiable qu'un simple écouteur "resize" de la fenêtre.
   */
  observerTaille(canvas, callback) {
    callback();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', callback);
      return;
    }
    const ro = new ResizeObserver(() => callback());
    ro.observe(canvas);
    if (canvas.parentElement) ro.observe(canvas.parentElement);
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
    const xEcran = largeur * 0.90;

    // Échelle utilisée pour les éléments à taille "fixe" (zone de dépôt,
    // tubes...) afin qu'ils rétrécissent sur un canvas étroit (mobile en
    // portrait) plutôt que de déborder du cadre.
    const echelle = Math.min(1, largeur / 700);

    // Positions (en pixels CSS, alignées sur canvas.offsetX/offsetY) de
    // chaque gaz actuellement posé sur le banc, pour permettre ensuite de
    // le glisser hors du schéma afin de le retirer.
    const zonesGaz = [];

    // ---- Zones de dépôt (halo pointillé, forme allongée) ----
    // Inutile en mode Identification (state.inconnu) : rien ne s'y dépose.
    if (!state.inconnu) {
      this._dessinerZoneDepot(ctx, xSource, yMid, state.survolZone === 'source' && state.type === 'emission', largeur);
      if (state.type === 'absorption') {
        this._dessinerZoneDepot(ctx, xAbsorption, yMid, state.survolZone === 'absorption', largeur);
      }
    }

    // ---- Source ----
    let couleurFaisceauEntree; // couleur du trait avant le prisme
    let raiesActives = null;   // raies à décomposer après le prisme (emission)
    let estContinu = false;    // vrai si un faisceau blanc continu circule (absorption, lampe allumée)

    if (state.type === 'emission') {
      const gazListe = state.gazEmission || [];
      if (gazListe.length) {
        this._dessinerTubesGaz(ctx, xSource, yMid, gazListe, state.inconnu, zonesGaz, echelle);
        raiesActives = [].concat(...gazListe.map(g => g.raies));
        couleurFaisceauEntree = this.couleurGlobaleRaies(raiesActives);
      } else {
        this._dessinerSupportVide(ctx, xSource, yMid, 'Glisse un gaz ici');
      }
    } else {
      this._dessinerLampe(ctx, xSource, yMid, state.sourceAllumee);
      if (state.sourceAllumee) {
        couleurFaisceauEntree = { r: 255, g: 250, b: 240 };
        estContinu = true;
      }
      const gazListe = state.gazAbsorption || [];
      if (gazListe.length) {
        raiesActives = [].concat(...gazListe.map(g => g.raies));
        this._dessinerCuvesGaz(ctx, xAbsorption, yMid, gazListe, state.inconnu, zonesGaz, echelle);
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
      this._dessinerEventailRaies(ctx, xPrisme, xEcran, yMid, hauteur, largeur, raiesActives, true);
    } else if (state.type === 'absorption' && estContinu) {
      this._dessinerEventailContinu(ctx, xPrisme, xEcran, yMid, hauteur, largeur, raiesActives);
    }

    // Rendu disponible pour le glisser-déposer de retrait (voir mode-spectre-raies.js)
    canvas._zonesGaz = zonesGaz;
  },

  /**
   * Cherche, parmi les gaz actuellement dessinés sur ce banc, celui le plus
   * proche du point (x, y) en pixels CSS (ex : event.offsetX/offsetY).
   * Renvoie son identifiant ou null si aucun gaz n'est assez proche.
   */
  gazAuPoint(canvas, x, y) {
    const zones = canvas._zonesGaz || [];
    for (const z of zones) {
      const d = Math.hypot(x - z.x, y - z.y);
      if (d <= z.rayon) return z.id;
    }
    return null;
  },

  _dessinerZoneDepot(ctx, x, y, survole, largeurCanvas) {
    // Facteurs choisis pour rester toujours nettement en retrait de la fente
    // et du prisme, même sur le canvas le plus étroit (mobile en portrait).
    const largeurZone = Math.min(110, largeurCanvas * 0.22);
    const hauteurZone = Math.min(70, largeurCanvas * 0.16);
    const rayon = Math.min(16, hauteurZone * 0.25);
    // On garde le centre demandé, mais on s'assure que le rectangle reste
    // entièrement dans le canvas (jamais tronqué sur les bords, même quand
    // la source est proche du bord gauche sur un canvas très étroit).
    const cx = Math.max(largeurZone / 2 + 4, Math.min(x, largeurCanvas - largeurZone / 2 - 4));
    ctx.save();
    ctx.strokeStyle = survole ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.16)';
    ctx.setLineDash([6, 6]);
    ctx.lineWidth = 2;
    roundRect(ctx, cx - largeurZone / 2, y - hauteurZone / 2, largeurZone, hauteurZone, rayon);
    ctx.stroke();
    ctx.restore();
  },

  _dessinerSupportVide(ctx, x, y, texte) {
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font = '11px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(texte, x, y + 6);
    ctx.restore();
  },

  /** Dessine un ou plusieurs tubes de gaz émetteurs, groupés en grappe serrée. */
  _dessinerTubesGaz(ctx, x, y, gazListe, inconnu, zonesGaz, echelle = 1) {
    const e = Math.max(0.4, echelle);
    const n = gazListe.length;
    const espace = 22 * e;
    const xDepart = x - ((n - 1) * espace) / 2;
    gazListe.forEach((gaz, i) => {
      const cx = xDepart + i * espace;
      const couleur = this.couleurGlobaleRaies(gaz.raies);
      this._dessinerTubeGaz(ctx, cx, y, couleur, inconnu, e);
      if (zonesGaz) zonesGaz.push({ id: gaz.id, x: cx, y, rayon: 26 * e });
    });
  },

  /** Dessine une ou plusieurs cuves de gaz absorbant, groupées en grappe serrée. */
  _dessinerCuvesGaz(ctx, x, y, gazListe, inconnu, zonesGaz, echelle = 1) {
    const e = Math.max(0.4, echelle);
    const n = gazListe.length;
    const espace = 20 * e;
    const xDepart = x - ((n - 1) * espace) / 2;
    gazListe.forEach((gaz, i) => {
      const cx = xDepart + i * espace;
      const couleur = this.couleurGlobaleRaies(gaz.raies);
      this._dessinerCuveGaz(ctx, cx, y, couleur, inconnu, e);
      if (zonesGaz) zonesGaz.push({ id: gaz.id, x: cx, y, rayon: 24 * e });
    });
  },

  _dessinerTubeGaz(ctx, x, y, couleur, inconnu, echelle = 1) {
    const c = inconnu ? { r: 190, g: 190, b: 196 } : couleur;
    ctx.save();
    // lueur
    const rGlow = 34 * echelle;
    const grad = ctx.createRadialGradient(x, y, 2, x, y, rGlow);
    grad.addColorStop(0, CouleurUtils.rgbToCss(c, 0.9));
    grad.addColorStop(1, CouleurUtils.rgbToCss(c, 0));
    ctx.fillStyle = grad;
    ctx.fillRect(x - rGlow, y - rGlow, rGlow * 2, rGlow * 2);
    // tube
    ctx.fillStyle = '#26282c';
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1.5;
    roundRect(ctx, x - 10 * echelle, y - 24 * echelle, 20 * echelle, 48 * echelle, 8 * echelle);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = `rgb(${c.r},${c.g},${c.b})`;
    roundRect(ctx, x - 6 * echelle, y - 18 * echelle, 12 * echelle, 36 * echelle, 5 * echelle);
    ctx.fill();
    if (inconnu) {
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      ctx.font = `bold ${Math.round(12 * echelle)}px -apple-system, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('?', x, y + 46 * echelle);
    }
    ctx.restore();
  },

  _dessinerCuveGaz(ctx, x, y, couleur, inconnu, echelle = 1) {
    const c = inconnu ? { r: 190, g: 190, b: 196 } : couleur;
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1.5;
    roundRect(ctx, x - 16 * echelle, y - 30 * echelle, 32 * echelle, 60 * echelle, 6 * echelle);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = CouleurUtils.rgbToCss(c, 0.5);
    ctx.fillRect(x - 14 * echelle, y - 10 * echelle, 28 * echelle, 38 * echelle);
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
  _dessinerEventailRaies(ctx, xPrisme, xEcran, yMid, hauteurCanvas, largeurCanvas, raies, avecImpact) {
    const yHautEventail = hauteurCanvas * 0.14;
    const yBasEventail = hauteurCanvas * 0.82;
    const epaisseurMur = hauteurCanvas * 0.02 + 4;
    // Espace réellement disponible à droite de l'écran : le trait ne doit
    // jamais dépasser le bord du canvas, quelle que soit sa largeur.
    const disponible = Math.max(6, largeurCanvas - (xEcran + epaisseurMur) - 4);
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
        // La raie apparaît comme un trait HORIZONTAL sur l'écran (et non un
        // petit rectangle), à l'image de ce qu'on observerait réellement.
        ctx.save();
        ctx.fillStyle = CouleurUtils.rgbToCss(rgb, 0.92);
        ctx.shadowColor = CouleurUtils.rgbToCss(rgb, 0.9);
        ctx.shadowBlur = 8;
        const epaisseur = 2.5 + r.intensite * 3;
        const longueur = Math.min(22 + r.intensite * 12, disponible);
        ctx.fillRect(xEcran + epaisseurMur, yImpact - epaisseur / 2, longueur, epaisseur);
        ctx.restore();
      }
    });
  },

  /** Éventail continu (arc-en-ciel) du prisme vers l'écran, creusé si des raies d'absorption sont fournies. */
  _dessinerEventailContinu(ctx, xPrisme, xEcran, yMid, hauteurCanvas, largeurCanvas, raiesAbsorbees) {
    const yHaut = hauteurCanvas * 0.14;
    const yBas = hauteurCanvas * 0.82;
    const epaisseurMur = hauteurCanvas * 0.02 + 4;
    const longueurImpact = Math.min(16, Math.max(4, largeurCanvas - (xEcran + epaisseurMur) - 4));
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
      ctx.fillRect(xEcran + epaisseurMur, yImpact - 1.5, longueurImpact, 3);
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
