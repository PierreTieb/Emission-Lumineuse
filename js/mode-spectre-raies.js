/*
 * mode-spectre-raies.js
 * Mode "Spectre de raies" : l'utilisateur choisit émission ou absorption,
 * glisse un gaz nommé sur le banc optique, et peut afficher son spectre.
 */

const ModeSpectreRaies = {

  state: {
    type: 'emission',
    gazEmission: [],
    gazAbsorption: [],
    sourceAllumee: false,
    survolZone: null
  },

  init() {
    this.canvas = document.getElementById('canvas-banc-raies');
    this.bibliotheque = document.getElementById('liste-bouteilles-raies');
    this.btnAfficher = document.getElementById('btn-afficher-spectre-raies');
    this.btnVider = document.getElementById('btn-vider-raies');
    this.blocInterrupteur = document.getElementById('interrupteur-source');
    this.btnInterrupteur = document.getElementById('btn-interrupteur');

    this._construireBibliotheque();
    this._attacherBascule();
    this._attacherDragDrop();
    this._attacherRetraitVersBibliotheque();
    this._attacherRetraitDepuisSchema();

    this.btnInterrupteur.addEventListener('click', () => {
      this.state.sourceAllumee = !this.state.sourceAllumee;
      this.btnInterrupteur.setAttribute('aria-pressed', String(this.state.sourceAllumee));
      this._redessiner();
      this._mettreAJourBoutonAfficher();
    });

    this.btnVider.addEventListener('click', () => {
      if (this.state.type === 'emission') this.state.gazEmission = [];
      else this.state.gazAbsorption = [];
      this._redessiner();
      this._mettreAJourBoutonAfficher();
      this._actualiserBibliotheque();
    });

    this.btnAfficher.addEventListener('click', () => this._ouvrirSpectreEnGrand());

    SceneOptique.observerTaille(this.canvas, () => this._redessiner());
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

  /** Met en évidence dans la bibliothèque les gaz déjà placés sur le banc. */
  _actualiserBibliotheque() {
    const actifs = this.state.type === 'emission' ? this.state.gazEmission : this.state.gazAbsorption;
    const idsActifs = new Set(actifs.map(g => g.id));
    this.bibliotheque.querySelectorAll('.bouteille').forEach(el => {
      el.classList.toggle('selectionnee', idsActifs.has(el.dataset.gazId));
    });
  },

  /**
   * Permet de saisir un gaz déjà posé sur le schéma (glisser-déposer en
   * sortie) pour le déplacer, en particulier vers la bibliothèque afin de
   * le retirer.
   */
  _attacherRetraitDepuisSchema() {
    this.canvas.draggable = true;

    this.canvas.addEventListener('dragstart', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const gazId = SceneOptique.gazAuPoint(this.canvas, x, y);
      if (!gazId) { e.preventDefault(); return; }
      e.dataTransfer.setData('text/plain', gazId);
      e.dataTransfer.setData('application/x-origine-schema', gazId);
    });

    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const survole = SceneOptique.gazAuPoint(this.canvas, x, y);
      this.canvas.style.cursor = survole ? 'grab' : 'default';
    });
  },

  /** La bibliothèque agit aussi comme grande zone de dépôt pour retirer un gaz du schéma. */
  _attacherRetraitVersBibliotheque() {
    this.bibliotheque.addEventListener('dragover', (e) => {
      if (![...e.dataTransfer.types].includes('application/x-origine-schema')) return;
      e.preventDefault();
      this.bibliotheque.classList.add('survolee-retrait');
    });
    this.bibliotheque.addEventListener('dragleave', () => {
      this.bibliotheque.classList.remove('survolee-retrait');
    });
    this.bibliotheque.addEventListener('drop', (e) => {
      this.bibliotheque.classList.remove('survolee-retrait');
      if (![...e.dataTransfer.types].includes('application/x-origine-schema')) return;
      e.preventDefault();
      const gazId = e.dataTransfer.getData('text/plain');
      if (this.state.type === 'emission') {
        this.state.gazEmission = this.state.gazEmission.filter(g => g.id !== gazId);
      } else {
        this.state.gazAbsorption = this.state.gazAbsorption.filter(g => g.id !== gazId);
      }
      this._redessiner();
      this._mettreAJourBoutonAfficher();
      this._actualiserBibliotheque();
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
    this._actualiserBibliotheque();
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
        if (!this.state.gazEmission.some(g => g.id === gaz.id)) this.state.gazEmission.push(gaz);
      } else if (this.state.type === 'absorption' && zone === 'absorption') {
        if (!this.state.gazAbsorption.some(g => g.id === gaz.id)) this.state.gazAbsorption.push(gaz);
      }
      this._redessiner();
      this._mettreAJourBoutonAfficher();
      this._actualiserBibliotheque();
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
      ? this.state.gazEmission.length > 0
      : this.state.sourceAllumee; // en absorption, un faisceau existe dès que la lampe est allumée
    this.btnAfficher.disabled = !pret;
  },

  _ouvrirSpectreEnGrand() {
    let titre = '';
    if (this.state.type === 'emission') {
      const noms = this.state.gazEmission.map(g => g.nom).join(' + ');
      const raies = [].concat(...this.state.gazEmission.map(g => g.raies));
      titre = `Spectre d'émission : ${noms}`;
      ModalSpectre.ouvrir(titre, [{ raies }], this.state.type);
    } else {
      const raies = [].concat(...this.state.gazAbsorption.map(g => g.raies));
      titre = this.state.gazAbsorption.length
        ? `Spectre d'absorption : ${this.state.gazAbsorption.map(g => g.nom).join(' + ')}`
        : `Spectre continu (aucun gaz absorbant)`;
      ModalSpectre.ouvrir(titre, [{ raies }], this.state.type);
    }
  }
};
