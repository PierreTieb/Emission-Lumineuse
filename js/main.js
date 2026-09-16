/*
 * main.js
 * Navigation entre l'accueil et les 3 modes, initialisation générale.
 */

const TITRES = {
  'accueil': 'Spectres Lumineux',
  'corps-chaud': 'Corps chaud',
  'raies': 'Spectres de raies',
  'identification': 'Identifier un gaz'
};

const CLASSES_MODE = {
  'corps-chaud': 'mode-jaune',
  'raies': 'mode-verte',
  'identification': 'mode-bleue'
};

const Navigation = {
  ecranActuel: 'accueil',

  init() {
    this.titreEcran = document.getElementById('titre-ecran');
    this.btnRetour = document.getElementById('btn-retour');

    document.querySelectorAll('.carte-mode').forEach(carte => {
      carte.addEventListener('click', () => this.allerVers(carte.dataset.mode));
    });
    this.btnRetour.addEventListener('click', () => this.allerVers('accueil'));

    this.allerVers('accueil');
  },

  allerVers(cle) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('actif'));
    const idScreen = cle === 'accueil' ? 'screen-accueil' : `screen-${cle}`;
    document.getElementById(idScreen).classList.add('actif');

    this.titreEcran.textContent = TITRES[cle];
    this.btnRetour.classList.toggle('hidden', cle === 'accueil');
    this.ecranActuel = cle;

    // Laisse le navigateur appliquer le display avant de mesurer les canvas
    requestAnimationFrame(() => {
      if (cle === 'corps-chaud') ModeCorpsChaud.mettreAJour();
      if (cle === 'raies') ModeSpectreRaies.onAfficherEcran();
      if (cle === 'identification') ModeIdentification.onAfficherEcran();
    });
  }
};

const ModalSpectre = {
  init() {
    this.modal = document.getElementById('modal-spectre');
    this.titre = document.getElementById('modal-titre');
    this.canvas = document.getElementById('canvas-modal-spectre');
    this.btnFermer = document.getElementById('btn-fermer-modal');

    this.btnFermer.addEventListener('click', () => this.fermer());
    this.modal.addEventListener('click', (e) => { if (e.target === this.modal) this.fermer(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') this.fermer(); });
  },

  ouvrir(titre, groupesRaies, mode) {
    this.titre.textContent = titre;
    this.modal.classList.remove('hidden');
    requestAnimationFrame(() => {
      const { ctx, largeur, hauteur } = SceneOptique.ajusterResolution(this.canvas);
      SceneOptique.dessinerSpectrePlat(ctx, largeur, hauteur, groupesRaies, mode);
    });
  },

  fermer() {
    this.modal.classList.add('hidden');
  }
};

document.addEventListener('DOMContentLoaded', () => {
  ModeCorpsChaud.init();
  ModeSpectreRaies.init();
  ModeIdentification.init();
  ModalSpectre.init();
  Navigation.init();
});
