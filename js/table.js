// table.js
// Construit le tableau de conversion "brouillon" : 9 colonnes (une case vide
// au-delà de kilo, k h da _ d c m, une case vide au-delà de milli), une case
// texte invisible par colonne, avance automatique du curseur vers la droite
// après la saisie d'un chiffre (sauf en toute dernière colonne, où le
// curseur se retire et il faut recliquer). Le tableau peut être vidé à la
// demande (à chaque nouvelle conversion).
//
// Pour le mode Tuto, une fine rangée de flèches au-dessus de l'en-tête
// signale la colonne de départ (vert) et d'arrivée (rouge).

(function () {
  const COLUMN_LABELS = ['', 'k_', 'h_', 'da_', '_', 'd_', 'c_', 'm_', ''];

  let inputCells = [];
  let arrowCells = [];

  function buildTable(container) {
    container.innerHTML = '';
    inputCells = [];
    arrowCells = [];

    // Rangée de flèches (mode Tuto), vide et discrète le reste du temps
    const arrowRow = document.createElement('div');
    arrowRow.className = 'draft-row draft-arrow-row';
    COLUMN_LABELS.forEach(() => {
      const cell = document.createElement('div');
      cell.className = 'draft-cell draft-arrow-cell';
      arrowRow.appendChild(cell);
      arrowCells.push(cell);
    });
    container.appendChild(arrowRow);

    const headerRow = document.createElement('div');
    headerRow.className = 'draft-row draft-header';
    COLUMN_LABELS.forEach((label) => {
      const cell = document.createElement('div');
      cell.className = 'draft-cell draft-head-cell';
      cell.textContent = label;
      headerRow.appendChild(cell);
    });
    container.appendChild(headerRow);

    const inputRow = document.createElement('div');
    inputRow.className = 'draft-row draft-input-row';
    const inputs = [];

    COLUMN_LABELS.forEach((label, idx) => {
      const cell = document.createElement('div');
      cell.className = 'draft-cell draft-input-cell';

      const input = document.createElement('input');
      input.type = 'text';
      input.maxLength = 1;
      input.className = 'draft-input';
      input.inputMode = 'numeric';
      input.autocomplete = 'off';
      input.setAttribute('aria-label', label ? 'Colonne ' + label : 'Colonne supplémentaire');

      cell.appendChild(input);
      inputRow.appendChild(cell);
      inputs.push(input);
      inputCells.push(input);
    });

    container.appendChild(inputRow);

    inputs.forEach((input, idx) => {
      input.addEventListener('input', () => {
        const digitOnly = input.value.replace(/[^0-9]/g, '').slice(0, 1);
        input.value = digitOnly;

        if (digitOnly !== '') {
          if (idx < inputs.length - 1) {
            inputs[idx + 1].focus();
            inputs[idx + 1].select();
          } else {
            input.blur();
          }
        }
      });

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && input.value === '' && idx > 0) {
          inputs[idx - 1].focus();
          inputs[idx - 1].select();
        }
      });
    });
  }

  // Vide toutes les cases du tableau sans le reconstruire (les écouteurs
  // restent en place). Efface aussi les flèches du mode Tuto.
  function resetTable(container) {
    const inputs = container.querySelectorAll('.draft-input');
    inputs.forEach((input) => {
      input.value = '';
    });
    clearArrows();
  }

  // --- API dédiée au mode Tuto ---

  function setColumnArrow(colIndex, type) {
    const cell = arrowCells[colIndex];
    if (!cell) return;
    cell.textContent = '↓';
    cell.className = 'draft-cell draft-arrow-cell ' + (type === 'to' ? 'arrow-red' : 'arrow-green');
  }

  function clearArrows() {
    arrowCells.forEach((cell) => {
      cell.textContent = '';
      cell.className = 'draft-cell draft-arrow-cell';
    });
  }

  function getCellValue(colIndex) {
    const input = inputCells[colIndex];
    return input ? input.value : '';
  }

  // Place les chiffres d'une valeur entière dans les bonnes colonnes, en
  // partant de la colonne de son unité (rank) pour le chiffre des unités,
  // et en remontant vers la gauche pour les chiffres plus significatifs.
  // Ne place jamais de virgule (n'a de sens que pour un nombre entier).
  function fillDigits(rank, value) {
    const digits = Math.abs(Math.trunc(value)).toString().split('');
    const unitColumn = rank + 1;
    const startColumn = unitColumn - (digits.length - 1);
    digits.forEach((digit, i) => {
      const col = startColumn + i;
      if (inputCells[col]) {
        inputCells[col].value = digit;
      }
    });
  }

  function flashCellError(colIndex) {
    const input = inputCells[colIndex];
    if (!input) return;
    input.classList.add('wrong');
    setTimeout(() => input.classList.remove('wrong'), 500);
  }

  window.DraftTable = {
    buildTable,
    resetTable,
    setColumnArrow,
    clearArrows,
    getCellValue,
    flashCellError,
    fillDigits
  };
})();
