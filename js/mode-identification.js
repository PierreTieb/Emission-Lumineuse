/*
 * mode-identification.js
 * Mode "Identifier un gaz" : un défi est généré aléatoirement (type de
 * spectre + un ou deux gaz cachés), l'utilisateur observe le spectre puis
 * doit retrouver le(s) gaz correspondant(s) dans la bibliothèque.
 */

const ModeIdentification = {

  defi: null, // { type, gazIds: [...] }
  selection: new Set(),
  sourceAllumee: true,

  init() {
    this.canvas = document.getElementById('canvas-banc-identification');
    this.btnNouveauDefi = document.getElementById('btn-nouveau-defi');
    this.btnIdentifier = document.getElementById('btn-identifier');
    this.btnValider = document.getElementById('btn-valider-identification');
    this.optionMelange = document.getElementById('option-melange');
    this.statut = document.getElementById('statut-defi');
    this.zoneIdentification = document.getElementById('zone-identification');
    this.listeChoix = document.getElementById('liste-bouteilles-identification');
    this.canvasSelection = document.getElementById('canvas-spectre-selection');
    this.blocInterrupteur = document.getElementById('interrupteur-source-id');
    this.btnInterrupteur = document.getElementById('btn-interrupteur-id');
    this.titreIdentification = document.getElementById('titre-identification');
    this.confettiConteneur = document.getElementById('confetti-conteneur');

    this._construireBibliothequeChoix();

    this.btnNouveauDefi.addEventListener('click', () => this._genererDefi());
    this.btnIdentifier.addEventListener('click', () => this._passerEnIdentification());
    this.btnValider.addEventListener('click', () => this._valider());
    this.btnInterrupteur.addEventListener('click', () => {
      this.sourceAllumee = !this.sourceAllumee;
      this.btnInterrupteur.setAttribute('aria-pressed', String(this.sourceAllumee));
      this._redessinerTout();
    });

    SceneOptique.observerTaille(this.canvas, () => this._redessinerTout());
  },

  onAfficherEcran() {
    if (!this.defi) this._genererDefi();
    else this._redessinerTout();
  },

  _construireBibliothequeChoix() {
    this.listeChoix.innerHTML = '';
    DataGaz.gaz.forEach(gaz => {
      const el = document.createElement('div');
      el.className = 'bouteille bouteille-choix';
      el.dataset.gazId = gaz.id;
      el.innerHTML = `
        <div class="bouteille-corps">
          <div class="bouteille-col" style="background:${gaz.couleurGlobale}"></div>
        </div>
        <div class="bouteille-nom">${gaz.nom}</div>
      `;
      el.addEventListener('click', () => this._basculerSelection(gaz.id, el));
      this.listeChoix.appendChild(el);
    });
  },

  _genererDefi() {
    const melange = this.optionMelange.checked;
    const nbGaz = melange ? 2 : 1;
    const type = Math.random() < 0.5 ? 'emission' : 'absorption';
    const idsDisponibles = DataGaz.gaz.map(g => g.id);
    const gazIds = [];
    while (gazIds.length < nbGaz) {
      const id = idsDisponibles[Math.floor(Math.random() * idsDisponibles.length)];
      if (!gazIds.includes(id)) gazIds.push(id);
    }
    this.defi = { type, gazIds };
    this.selection = new Set();
    this.sourceAllumee = true;

    this.zoneIdentification.classList.add('hidden');
    this.statut.textContent = '';
    this.statut.className = 'statut-defi';
    this.btnIdentifier.disabled = false;
    document.querySelectorAll('#liste-bouteilles-identification .bouteille').forEach(b => b.classList.remove('selectionnee'));

    this.titreIdentification.textContent = nbGaz > 1 ? 'Quels gaz reconnais-tu ?' : 'Quel gaz reconnais-tu ?';

    this.blocInterrupteur.classList.toggle('hidden', type !== 'absorption');
    this.btnInterrupteur.setAttribute('aria-pressed', 'true');
    this._redessinerTout();
  },

  _raiesDuDefi() {
    return this.defi.gazIds.map(id => DataGaz.parId(id));
  },

  _redessinerTout() {
    if (!this.defi) return;
    const gazObjets = this._raiesDuDefi();

    const state = {
      type: this.defi.type,
      inconnu: true,
      sourceAllumee: this.sourceAllumee,
      gazEmission: this.defi.type === 'emission' ? gazObjets : [],
      gazAbsorption: this.defi.type === 'absorption' ? gazObjets : [],
      survolZone: null
    };
    SceneOptique.dessinerBanc(this.canvas, state);

    if (!this.zoneIdentification.classList.contains('hidden')) {
      this._redessinerComparaison();
    }
  },

  _passerEnIdentification() {
    this.zoneIdentification.classList.remove('hidden');
    this._redessinerComparaison();
    if (typeof this.zoneIdentification.scrollIntoView === 'function') {
      this.zoneIdentification.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  },

  _basculerSelection(gazId, el) {
    const maxSelection = this.defi.gazIds.length;
    if (this.selection.has(gazId)) {
      this.selection.delete(gazId);
      el.classList.remove('selectionnee');
    } else {
      if (this.selection.size >= maxSelection) {
        // On remplace la plus ancienne sélection pour rester dans la limite du défi
        const premiere = this.selection.values().next().value;
        this.selection.delete(premiere);
        document.querySelector(`#liste-bouteilles-identification .bouteille[data-gaz-id="${premiere}"]`)?.classList.remove('selectionnee');
      }
      this.selection.add(gazId);
      el.classList.add('selectionnee');
    }
    this._redessinerComparaison();
  },

  _redessinerComparaison() {
    const gazSelectionnes = [...this.selection].map(id => DataGaz.parId(id));
    const raiesSelection = [].concat(...gazSelectionnes.map(g => g.raies));
    const { ctx: ctxS, largeur: lS, hauteur: hS } = SceneOptique.ajusterResolution(this.canvasSelection);
    SceneOptique.dessinerSpectrePlat(ctxS, lS, hS, [{ raies: raiesSelection }], this.defi.type);
  },

  _valider() {
    const attendus = new Set(this.defi.gazIds);
    const propose = this.selection;
    const identique = attendus.size === propose.size && [...attendus].every(id => propose.has(id));

    if (identique) {
      const noms = this._raiesDuDefi().map(g => g.nom).join(' + ');
      this.statut.textContent = `Bravo ! Il s'agissait bien de : ${noms}.`;
      this.statut.className = 'statut-defi succes';
      this._lancerConfettis();
    } else {
      this.statut.textContent = `Ce n'est pas encore ça, compare bien les positions des raies puis réessaie.`;
      this.statut.className = 'statut-defi echec';
    }
  },

  /** Petite pluie de confettis autour du bouton Valider, en pur CSS/JS. */
  _lancerConfettis() {
    if (!this.confettiConteneur) return;
    this.confettiConteneur.innerHTML = '';
    const couleurs = ['#93d0a4', '#93bce0', '#e8c874', '#e8927d', '#c9a4e8'];
    const nb = 28;
    for (let i = 0; i < nb; i++) {
      const piece = document.createElement('span');
      piece.className = 'confetti-piece';
      piece.style.setProperty('--couleur', couleurs[i % couleurs.length]);
      piece.style.setProperty('--x', `${(Math.random() * 2 - 1) * 100}px`);
      piece.style.setProperty('--rotation', `${Math.random() * 360}deg`);
      piece.style.setProperty('--delai', `${Math.random() * 0.15}s`);
      piece.style.left = `${40 + Math.random() * 20}%`;
      this.confettiConteneur.appendChild(piece);
    }
    window.clearTimeout(this._confettiTimeout);
    this._confettiTimeout = window.setTimeout(() => {
      if (this.confettiConteneur) this.confettiConteneur.innerHTML = '';
    }, 1300);
  }
};
