/*
 * mode-spectre-raies.js
 * Mode "Spectre de raies" : l'utilisateur choisit émission ou absorption,
 * glisse un gaz nommé sur le banc optique, et peut afficher son spectre.
 */

const ModeSpectreRaies = {

  state: {
    type: 'emission',
    gazEmission: null,
    gazAbsorption: null,
    sourceAllumee: false,
    survolZone: null
  },

  init() {
    this.canvas = document.getElementById('canvas-banc-raies');
    this.bibliotheque = document.getElementById('liste-bouteilles-raies');
    this.btnAfficher = document.getElementById('btn-afficher-spectre-raies');
    this.blocInterrupteur = document.getElementById('interrupteur-source');
    this.btnInterrupteur = document.getElementById('btn-interrupteur');

    this._construireBibliotheque();
    this._attacherBascule();
    this._attacherDragDrop();

    this.btnInterrupteur.addEventListener('click', () => {
      this.state.sourceAllumee = !this.state.sourceAllumee;
      this.btnInterrupteur.setAttribute('aria-pressed', String(this.state.sourceAllumee));
      this._redessiner();
      this._mettreAJourBoutonAfficher();
    });

    this.btnAfficher.addEventListener('click', () => this._ouvrirSpectreEnGrand());

    window.addEventListener('resize', () => this._redessiner());
    this._appliquerType('emission');
  },

  /** Appelé par main.js quand on revient sur cet écran, pour s'assurer que le canvas a la bonne résolution. */
  onAfficherEcran() {
    this._redessiner();
  },

  _construireBibliotheque() {
    this.bibliotheque.innerHTML = '';
    DataGaz.gaz.forEach(gaz => {
      const el = document.createElement('div');
      el.className = 'bouteille';
      el.draggable = true;
      el.dataset.gazId = gaz.id;
      el.innerHTML = `
        <div class="bouteille-corps">
          <div class="bouteille-col" style="background:${gaz.couleurGlobale}"></div>
        </div>
        <div class="bouteille-nom">${gaz.nom}</div>
      `;
      el.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', gaz.id);
        el.classList.add('est-glissee');
      });
      el.addEventListener('dragend', () => el.classList.remove('est-glissee'));
      this.bibliotheque.appendChild(el);
    });
  },

  _attacherBascule() {
    const boutons = document.querySelectorAll('#screen-raies .bascule-btn');
    boutons.forEach(btn => {
      btn.addEventListener('click', () => {
        boutons.forEach(b => b.classList.remove('actif'));
        btn.classList.add('actif');
        this._appliquerType(btn.dataset.type);
      });
    });
  },

  _appliquerType(type) {
    this.state.type = type;
    this.blocInterrupteur.classList.toggle('hidden', type !== 'absorption');
    this._redessiner();
    this._mettreAJourBoutonAfficher();
  },

  _attacherDragDrop() {
    this.canvas.addEventListener('dragover', (e) => {
      e.preventDefault();
      this.state.survolZone = this._zoneSousCurseur(e);
      this._redessiner();
    });
    this.canvas.addEventListener('dragleave', () => {
      this.state.survolZone = null;
      this._redessiner();
    });
    this.canvas.addEventListener('drop', (e) => {
      e.preventDefault();
      const gazId = e.dataTransfer.getData('text/plain');
      const gaz = DataGaz.parId(gazId);
      const zone = this._zoneSousCurseur(e);
      this.state.survolZone = null;
      if (!gaz) return;
      if (this.state.type === 'emission' && zone === 'source') {
        this.state.gazEmission = gaz;
      } else if (this.state.type === 'absorption' && zone === 'absorption') {
        this.state.gazAbsorption = gaz;
      }
      this._redessiner();
      this._mettreAJourBoutonAfficher();
    });
  },

  _zoneSousCurseur(e) {
    const rect = this.canvas.getBoundingClientRect();
    const xRel = (e.clientX - rect.left) / rect.width;
    if (this.state.type === 'emission') {
      return xRel < 0.22 ? 'source' : null;
    }
    // En absorption, seule la cuve entre la fente et le prisme est une cible
    // (la lampe, elle, est fixe et s'allume via l'interrupteur).
    return (xRel > 0.36 && xRel < 0.56) ? 'absorption' : null;
  },

  _redessiner() {
    SceneOptique.dessinerBanc(this.canvas, this.state);
  },

  _mettreAJourBoutonAfficher() {
    const pret = this.state.type === 'emission'
      ? !!this.state.gazEmission
      : !!(this.state.sourceAllumee); // en absorption, un faisceau existe dès que la lampe est allumée
    this.btnAfficher.disabled = !pret;
  },

  _ouvrirSpectreEnGrand() {
    const groupes = [];
    let titre = '';
    if (this.state.type === 'emission') {
      groupes.push({ raies: this.state.gazEmission.raies });
      titre = `Spectre d'émission — ${this.state.gazEmission.nom}`;
    } else {
      groupes.push({ raies: this.state.gazAbsorption ? this.state.gazAbsorption.raies : [] });
      titre = this.state.gazAbsorption
        ? `Spectre d'absorption — ${this.state.gazAbsorption.nom}`
        : `Spectre continu (aucun gaz absorbant)`;
    }
    ModalSpectre.ouvrir(titre, groupes, this.state.type);
  }
};
