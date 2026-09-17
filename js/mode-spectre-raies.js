/*
 * mode-spectre-raies.js
 * Mode "Spectre de raies" : l'utilisateur choisit émission ou absorption,
 * glisse un gaz nommé sur le banc optique, et peut afficher son spectre.
 *
 * Le glisser-déposer est géré "à la main" avec les Pointer Events (et non
 * l'API HTML5 Drag and Drop classique) car cette dernière ne fonctionne pas
 * au doigt sur la plupart des navigateurs mobiles. Les Pointer Events, eux,
 * unifient souris, doigt et stylet et fonctionnent partout.
 */

const ModeSpectreRaies = {

  state: {
    type: 'emission',
    gazEmission: [],
    gazAbsorption: [],
    sourceAllumee: false,
    survolZone: null
  },

  drag: null, // { gazId, origine: 'bibliotheque' | 'schema', fantome }

  init() {
    this.canvas = document.getElementById('canvas-banc-raies');
    this.bibliotheque = document.getElementById('liste-bouteilles-raies');
    this.btnAfficher = document.getElementById('btn-afficher-spectre-raies');
    this.btnVider = document.getElementById('btn-vider-raies');
    this.blocInterrupteur = document.getElementById('interrupteur-source');
    this.btnInterrupteur = document.getElementById('btn-interrupteur');

    this._construireBibliotheque();
    this._attacherBascule();
    this._attacherGlisserDepuisSchema();
    this._attacherSuiviGlobalDuGlisser();

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
      el.dataset.gazId = gaz.id;
      el.innerHTML = `
        <div class="bouteille-corps">
          <div class="bouteille-col" style="background:${gaz.couleurGlobale}"></div>
        </div>
        <div class="bouteille-nom">${gaz.nom}</div>
      `;
      el.addEventListener('pointerdown', (e) => {
        if (this.drag) return;
        e.preventDefault();
        this._demarrerGlisser(gaz.id, 'bibliotheque', e.clientX, e.clientY);
      });
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

  /** Permet de saisir un gaz déjà posé sur le schéma pour le déplacer (notamment vers la bibliothèque pour le retirer). */
  _attacherGlisserDepuisSchema() {
    this.canvas.style.touchAction = 'none';
    this.canvas.addEventListener('pointerdown', (e) => {
      if (this.drag) return;
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const gazId = SceneOptique.gazAuPoint(this.canvas, x, y);
      if (!gazId) return;
      e.preventDefault();
      this._demarrerGlisser(gazId, 'schema', e.clientX, e.clientY);
    });

    // Curseur "attrape-moi" quand on survole un gaz déjà posé (souris uniquement).
    this.canvas.addEventListener('pointermove', (e) => {
      if (this.drag || e.pointerType !== 'mouse') return;
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const survole = SceneOptique.gazAuPoint(this.canvas, x, y);
      this.canvas.style.cursor = survole ? 'grab' : 'default';
    });
  },

  /** Démarre un glisser : crée un petit flacon "fantôme" qui suit le doigt/curseur. */
  _demarrerGlisser(gazId, origine, x, y) {
    const gaz = DataGaz.parId(gazId);
    if (!gaz) return;
    const fantome = document.createElement('div');
    fantome.className = 'fantome-glisser';
    fantome.innerHTML = `<div class="bouteille-corps"><div class="bouteille-col" style="background:${gaz.couleurGlobale}"></div></div>`;
    document.body.appendChild(fantome);

    this.drag = { gazId, origine, fantome };
    this._positionnerFantome(x, y);
    document.body.classList.add('glisser-actif');
  },

  _positionnerFantome(x, y) {
    if (!this.drag) return;
    this.drag.fantome.style.left = `${x}px`;
    this.drag.fantome.style.top = `${y}px`;
  },

  /**
   * Écoute globalement les mouvements et le relâchement du pointeur pendant
   * un glisser, quel que soit l'endroit de l'écran survolé.
   */
  _attacherSuiviGlobalDuGlisser() {
    window.addEventListener('pointermove', (e) => {
      if (!this.drag) return;
      this._positionnerFantome(e.clientX, e.clientY);

      const rectCanvas = this.canvas.getBoundingClientRect();
      const dansCanvas = this._pointDansRect(e.clientX, e.clientY, rectCanvas);
      this.state.survolZone = dansCanvas
        ? this._zoneDepuisPoint(e.clientX - rectCanvas.left, e.clientY - rectCanvas.top)
        : null;
      this._redessiner();

      const rectBib = this.bibliotheque.getBoundingClientRect();
      const dansBib = this._pointDansRect(e.clientX, e.clientY, rectBib);
      this.bibliotheque.classList.toggle('survolee-retrait', dansBib && this.drag.origine === 'schema');
    });

    window.addEventListener('pointerup', (e) => this._terminerGlisser(e.clientX, e.clientY));
    window.addEventListener('pointercancel', () => this._annulerGlisser());
  },

  _pointDansRect(x, y, rect) {
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  },

  _terminerGlisser(x, y) {
    if (!this.drag) return;
    const { gazId, origine } = this.drag;
    const gaz = DataGaz.parId(gazId);

    const rectCanvas = this.canvas.getBoundingClientRect();
    const rectBib = this.bibliotheque.getBoundingClientRect();
    const dansCanvas = this._pointDansRect(x, y, rectCanvas);
    const dansBib = this._pointDansRect(x, y, rectBib);

    if (dansCanvas && gaz) {
      const zone = this._zoneDepuisPoint(x - rectCanvas.left, y - rectCanvas.top);
      if (this.state.type === 'emission' && zone === 'source') {
        if (!this.state.gazEmission.some(g => g.id === gaz.id)) this.state.gazEmission.push(gaz);
      } else if (this.state.type === 'absorption' && zone === 'absorption') {
        if (!this.state.gazAbsorption.some(g => g.id === gaz.id)) this.state.gazAbsorption.push(gaz);
      }
    } else if (dansBib && origine === 'schema') {
      if (this.state.type === 'emission') {
        this.state.gazEmission = this.state.gazEmission.filter(g => g.id !== gazId);
      } else {
        this.state.gazAbsorption = this.state.gazAbsorption.filter(g => g.id !== gazId);
      }
    }

    this._nettoyerGlisser();
    this._redessiner();
    this._mettreAJourBoutonAfficher();
    this._actualiserBibliotheque();
  },

  _annulerGlisser() {
    this._nettoyerGlisser();
    this._redessiner();
  },

  _nettoyerGlisser() {
    if (this.drag) {
      this.drag.fantome.remove();
      this.drag = null;
    }
    this.state.survolZone = null;
    this.bibliotheque.classList.remove('survolee-retrait');
    document.body.classList.remove('glisser-actif');
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

  _zoneDepuisPoint(xPix, yPix) {
    const rect = this.canvas.getBoundingClientRect();
    const xRel = xPix / rect.width;
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
