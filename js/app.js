// app.js
// Contrôleur principal : navigation entre écrans, logique d'un exercice
// généré (facile / moyen / évaluation), logique du mode Custom, logique du
// mode Tuto guidé, chronomètre et score.

(function () {
  // --- Références DOM communes ---
  const screens = {
    home: document.getElementById('screen-home'),
    exercise: document.getElementById('screen-exercise'),
    custom: document.getElementById('screen-custom'),
    tuto: document.getElementById('screen-tuto'),
    recap: document.getElementById('screen-recap')
  };

  const diffCards = document.querySelectorAll('.diff-card');
  const btnBack = document.getElementById('btn-back');
  const btnBackCustom = document.getElementById('btn-back-custom');
  const btnBackTuto = document.getElementById('btn-back-tuto');
  const chronoEl = document.getElementById('chrono');
  const chronoValueEl = document.getElementById('chrono-value');
  const scoreDisplayEl = document.getElementById('score-display');
  const scoreValueEl = document.getElementById('score-value');

  const fromValueEl = document.getElementById('from-value');
  const fromUnitEl = document.getElementById('from-unit');
  const toUnitEl = document.getElementById('to-unit');
  const answerInput = document.getElementById('answer-input');
  const btnHint = document.getElementById('btn-hint');
  const btnValidate = document.getElementById('btn-validate');
  const btnNext = document.getElementById('btn-next');
  const feedbackEl = document.getElementById('feedback');

  const recapTitle = document.getElementById('recap-title');
  const recapScore = document.getElementById('recap-score');
  const recapTime = document.getElementById('recap-time');
  const recapMessage = document.getElementById('recap-message');
  const recapCard = document.getElementById('recap-card');
  const btnRestart = document.getElementById('btn-restart');
  const btnHome = document.getElementById('btn-home');

  const draftWrap = document.getElementById('draft-table-wrap');
  const draftTableEl = document.getElementById('draft-table');
  const confettiCanvas = document.getElementById('confetti-canvas');

  // --- Références DOM du mode Custom ---
  const customFromValueInput = document.getElementById('custom-from-value');
  const customFromUnitSelect = document.getElementById('custom-from-unit');
  const customToValueInput = document.getElementById('custom-to-value');
  const customToUnitSelect = document.getElementById('custom-to-unit');
  const btnCustomValidate = document.getElementById('btn-custom-validate');
  const btnCustomSolve = document.getElementById('btn-custom-solve');
  const customFeedbackEl = document.getElementById('custom-feedback');

  // --- Références DOM du mode Tuto ---
  const tutoFromValueEl = document.getElementById('tuto-from-value');
  const tutoFromUnitEl = document.getElementById('tuto-from-unit');
  const tutoToUnitEl = document.getElementById('tuto-to-unit');
  const tutoAnswerInput = document.getElementById('tuto-answer-input');
  const tutoStepTextEl = document.getElementById('tuto-step-text');
  const btnTutoPrev = document.getElementById('btn-tuto-prev');
  const btnTutoNext = document.getElementById('btn-tuto-next');
  const btnTutoValidate = document.getElementById('btn-tuto-validate');
  const tutoFeedbackEl = document.getElementById('tuto-feedback');
  const tutoSuccessEl = document.getElementById('tuto-success');
  const btnTutoRetry = document.getElementById('btn-tuto-retry');
  const btnTutoHome = document.getElementById('btn-tuto-home');
  const tutoStack = document.querySelector('#screen-tuto .conversion-stack');

  const TUTO_STEP_TEXTS = {
    1: 'Étape 1 : Repérer la <span class="text-tuto-green">colonne de départ</span> et la <span class="text-tuto-red">colonne d\u2019arrivée</span>',
    2: 'Étape 2 : Repérer le chiffre des unités et le placer dans la <span class="text-tuto-green">colonne de départ</span><span class="tuto-substep">C\u2019est le chiffre juste avant la virgule</span>',
    3: 'Étape 3 : Placer les autres chiffres, mais sans la virgule',
    4: 'Étape 4 : Compléter avec des zéros jusqu\u2019à la <span class="text-tuto-red">colonne d\u2019arrivée</span>, et y placer mentalement une virgule si besoin'
  };

  // --- État ---
  let currentLevel = 'facile';
  let currentConversion = null;
  let hasFailedOnce = false;
  let advanceTimeoutId = null;
  let chronoIntervalId = null;
  let questionStart = 0;
  let evalStats = { count: 0, correctCount: 0, times: [] };
  let sessionScore = { correct: 0, total: 0 };
  let customRevealed = false;

  let tutoConversion = null;
  let tutoStep = 1;

  // --- Tableau brouillon (construit une seule fois) ---
  DraftTable.buildTable(draftTableEl);

  // --- Confettis "sûrs" : un souci d'affichage ne doit jamais bloquer le jeu ---
  function safeBurstConfetti() {
    try {
      Confetti.burst(confettiCanvas);
    } catch (e) {
      /* l'animation est purement décorative : on ignore silencieusement */
    }
  }

  // --- Utilitaire : n'autoriser que chiffres + un seul séparateur décimal ---
  function attachNumericSanitizer(input) {
    input.addEventListener('input', () => {
      const raw = input.value;
      let cleaned = '';
      let sepUsed = false;
      for (let i = 0; i < raw.length; i++) {
        const ch = raw[i];
        if (ch === '.' || ch === ',') {
          if (!sepUsed) {
            cleaned += ch;
            sepUsed = true;
          }
        } else if (ch >= '0' && ch <= '9') {
          cleaned += ch;
        }
      }
      input.value = cleaned;
    });
  }
  attachNumericSanitizer(answerInput);
  attachNumericSanitizer(customFromValueInput);
  attachNumericSanitizer(customToValueInput);
  attachNumericSanitizer(tutoAnswerInput);

  // --- Navigation entre écrans ---
  function showScreen(name) {
    Object.keys(screens).forEach((key) => {
      screens[key].classList.toggle('active', key === name);
    });
    const showTable = name === 'exercise' || name === 'custom' || name === 'tuto';
    draftWrap.classList.toggle('hidden', !showTable);
  }

  function clearPendingTimers() {
    if (advanceTimeoutId) {
      clearTimeout(advanceTimeoutId);
      advanceTimeoutId = null;
    }
    if (chronoIntervalId) {
      clearInterval(chronoIntervalId);
      chronoIntervalId = null;
    }
  }

  function goHome() {
    clearPendingTimers();
    chronoEl.classList.add('hidden');
    scoreDisplayEl.classList.add('hidden');
    setTheme('');
    showScreen('home');
  }

  // Applique une couleur de fond différente selon le mode actif (pur habillage,
  // n'affecte aucune logique de jeu).
  function setTheme(name) {
    document.body.dataset.theme = name;
  }

  // ===================================================================
  //  Modes générés : Facile / Moyen / Évaluation
  // ===================================================================

  function updateScoreDisplay() {
    scoreValueEl.textContent = sessionScore.correct + '/' + sessionScore.total;
  }

  function startSession(level) {
    currentLevel = level;
    setTheme(level);

    if (level === 'evaluation') {
      evalStats = { count: 0, correctCount: 0, times: [] };
      chronoEl.classList.remove('hidden');
      scoreDisplayEl.classList.add('hidden');
    } else if (level === 'facile' || level === 'moyen') {
      sessionScore = { correct: 0, total: 0 };
      updateScoreDisplay();
      chronoEl.classList.add('hidden');
      scoreDisplayEl.classList.remove('hidden');
    } else {
      chronoEl.classList.add('hidden');
      scoreDisplayEl.classList.add('hidden');
    }

    showScreen('exercise');
    loadNewConversion();
  }

  function loadNewConversion() {
    clearPendingTimers();
    hasFailedOnce = false;
    DraftTable.resetTable(draftTableEl); // Modif 1 : tableau vidé à chaque nouvelle conversion

    const generationLevel = currentLevel === 'evaluation' ? 'moyen' : currentLevel;
    currentConversion = Generator.generate(generationLevel);

    fromValueEl.textContent = Generator.formatNumberFR(currentConversion.fromValue);
    fromUnitEl.textContent = currentConversion.fromLabel;
    toUnitEl.textContent = currentConversion.toLabel;

    answerInput.value = '';
    answerInput.classList.remove('wrong', 'revealed');
    answerInput.disabled = false;
    answerInput.focus();

    btnValidate.disabled = false;
    btnValidate.classList.remove('hidden');
    btnNext.classList.add('hidden');

    btnHint.classList.toggle('hidden', currentLevel !== 'facile');
    btnHint.disabled = false;

    feedbackEl.textContent = '';
    feedbackEl.className = 'feedback';

    if (currentLevel === 'evaluation') {
      questionStart = performance.now();
      updateChrono();
      chronoIntervalId = setInterval(updateChrono, 100);
    }
  }

  function updateChrono() {
    const elapsed = (performance.now() - questionStart) / 1000;
    chronoValueEl.textContent = elapsed.toFixed(1) + ' s';
  }

  function onHintClick() {
    if (!currentConversion) return;
    DraftTable.fillDigits(currentConversion.fromRank, currentConversion.fromValue);
  }

  function validateAnswer() {
    const parsed = Generator.parseUserValue(answerInput.value);

    if (isNaN(parsed)) {
      feedbackEl.textContent = 'Entre un nombre valide (chiffres, virgule ou point).';
      feedbackEl.className = 'feedback info';
      return;
    }

    if (Generator.nearlyEqual(parsed, currentConversion.answer)) {
      handleSuccess();
    } else {
      handleFailure();
    }
  }

  function handleSuccess() {
    feedbackEl.textContent = 'Bravo, c\'est la bonne réponse !';
    feedbackEl.className = 'feedback success';
    answerInput.disabled = true;
    btnValidate.disabled = true;
    btnNext.classList.add('hidden');
    btnHint.disabled = true;

    if (currentLevel === 'evaluation') {
      clearInterval(chronoIntervalId);
      chronoIntervalId = null;
      const elapsed = (performance.now() - questionStart) / 1000;
      evalStats.times.push(elapsed);
      evalStats.correctCount += 1;
      evalStats.count += 1;
    } else if (currentLevel === 'facile' || currentLevel === 'moyen') {
      sessionScore.total += 1;
      if (!hasFailedOnce) sessionScore.correct += 1;
      updateScoreDisplay();
    }

    advanceTimeoutId = setTimeout(() => {
      if (currentLevel === 'evaluation' && evalStats.count >= 5) {
        showRecap();
      } else {
        loadNewConversion();
      }
    }, 1100);

    safeBurstConfetti();
  }

  function handleFailure() {
    answerInput.value = '';
    answerInput.classList.add('wrong');
    feedbackEl.textContent = 'Ce n\'est pas la bonne réponse, réessaie !';
    feedbackEl.className = 'feedback error';
    hasFailedOnce = true;
    btnNext.classList.remove('hidden');
    answerInput.focus();
  }

  function revealAndContinue() {
    if (!hasFailedOnce) return;

    btnValidate.disabled = true;
    btnNext.disabled = true;
    btnHint.disabled = true;
    answerInput.disabled = true;
    answerInput.classList.remove('wrong');
    answerInput.classList.add('revealed');
    answerInput.value = Generator.formatNumberFR(currentConversion.answer);

    feedbackEl.textContent = 'La bonne réponse était : ' + Generator.formatNumberFR(currentConversion.answer) + ' ' + currentConversion.toLabel;
    feedbackEl.className = 'feedback info';

    if (currentLevel === 'evaluation') {
      clearInterval(chronoIntervalId);
      chronoIntervalId = null;
      const elapsed = (performance.now() - questionStart) / 1000;
      evalStats.times.push(elapsed);
      evalStats.count += 1;
    } else if (currentLevel === 'facile' || currentLevel === 'moyen') {
      sessionScore.total += 1; // ratée puis résolue (ou passée) = comptée comme une erreur
      updateScoreDisplay();
    }

    advanceTimeoutId = setTimeout(() => {
      btnNext.disabled = false;
      if (currentLevel === 'evaluation' && evalStats.count >= 5) {
        showRecap();
      } else {
        loadNewConversion();
      }
    }, 2000);
  }

  function showRecap() {
    clearPendingTimers();
    chronoEl.classList.add('hidden');

    const avg = evalStats.times.reduce((a, b) => a + b, 0) / evalStats.times.length;
    const score = evalStats.correctCount;

    recapScore.textContent = 'Score : ' + score + '/5';
    recapTime.textContent = 'Temps moyen par conversion : ' + avg.toFixed(1) + ' s';

    recapCard.classList.remove('festive');

    if (score === 5 && avg < 20) {
      recapTitle.textContent = '🎉 Bravo ! 🎉';
      recapMessage.textContent = 'Score parfait et rythme excellent, tu maîtrises parfaitement ces conversions !';
      recapMessage.className = 'recap-message green';
      recapCard.classList.add('festive');
      safeBurstConfetti();
    } else {
      recapTitle.textContent = 'Résultats';
      if (avg < 20) {
        recapMessage.textContent = 'Rythme satisfaisant !';
        recapMessage.className = 'recap-message green';
      } else if (avg <= 40) {
        recapMessage.textContent = 'Rythme un peu lent, mais correct.';
        recapMessage.className = 'recap-message yellow';
      } else if (score >= 2) {
        recapMessage.textContent = 'Rythme insuffisant, mais continue, tu progresses !';
        recapMessage.className = 'recap-message red';
      } else {
        recapMessage.textContent = 'Rythme insuffisant, entraîne-toi encore un peu.';
        recapMessage.className = 'recap-message red';
      }
    }

    showScreen('recap');
  }

  // ===================================================================
  //  Mode Custom
  // ===================================================================

  function populateFromUnitSelect() {
    customFromUnitSelect.innerHTML = '<option value="" disabled selected>Unité...</option>';
    Units.CATEGORIES.forEach((category) => {
      const group = document.createElement('optgroup');
      group.label = Units.CATEGORY_LABELS[category.key];
      Units.unitsForCategory(category.key).forEach((unit) => {
        const opt = document.createElement('option');
        opt.value = unit.id;
        opt.textContent = unit.label;
        group.appendChild(opt);
      });
      customFromUnitSelect.appendChild(group);
    });
  }

  function populateToUnitSelect(categoryKey) {
    customToUnitSelect.innerHTML = '<option value="" disabled selected>Unité...</option>';
    Units.unitsForCategory(categoryKey).forEach((unit) => {
      const opt = document.createElement('option');
      opt.value = unit.id;
      opt.textContent = unit.label;
      customToUnitSelect.appendChild(opt);
    });
    customToUnitSelect.disabled = false;
  }

  function resetCustomForm() {
    customRevealed = false;
    DraftTable.resetTable(draftTableEl); // Modif 1 : tableau vidé aussi entre 2 conversions custom

    customFromValueInput.value = '';
    customFromValueInput.disabled = false;

    customToValueInput.value = '';
    customToValueInput.disabled = true;
    customToValueInput.classList.remove('wrong', 'revealed');

    customFromUnitSelect.innerHTML = '<option value="" disabled selected>Unité...</option>';
    populateFromUnitSelect();
    customFromUnitSelect.disabled = false;

    customToUnitSelect.innerHTML = '<option value="" disabled selected>Unité...</option>';
    customToUnitSelect.disabled = true;

    btnCustomValidate.disabled = true;
    btnCustomSolve.disabled = true;
    btnCustomSolve.textContent = 'Résoudre';

    customFeedbackEl.textContent = '';
    customFeedbackEl.className = 'feedback';

    customFromValueInput.focus();
  }

  function startCustomSession() {
    setTheme('custom');
    showScreen('custom');
    resetCustomForm();
  }

  function onCustomFromUnitChange() {
    if (!customFromUnitSelect.value) return;
    const { categoryKey } = Units.parseUnitId(customFromUnitSelect.value);
    populateToUnitSelect(categoryKey);
    customToValueInput.value = '';
    customToValueInput.disabled = true;
    btnCustomValidate.disabled = true;
    btnCustomSolve.disabled = true;
  }

  function onCustomToUnitChange() {
    if (!customFromUnitSelect.value || !customToUnitSelect.value) return;
    customToValueInput.disabled = false;
    btnCustomValidate.disabled = false;
    btnCustomSolve.disabled = false;
  }

  function getCustomExpectedAnswer() {
    const fromValue = Generator.parseUserValue(customFromValueInput.value);
    if (isNaN(fromValue)) return null;
    const from = Units.parseUnitId(customFromUnitSelect.value);
    const to = Units.parseUnitId(customToUnitSelect.value);
    return {
      fromValue,
      toLabel: Units.unitLabel(Units.categoryByKey(to.categoryKey), to.rank),
      answer: Generator.computeAnswer(fromValue, from.rank, to.rank)
    };
  }

  function validateCustomAnswer() {
    const expected = getCustomExpectedAnswer();
    if (!expected) {
      customFeedbackEl.textContent = 'Indique d\'abord une valeur de départ valide.';
      customFeedbackEl.className = 'feedback info';
      return;
    }

    const userAnswer = Generator.parseUserValue(customToValueInput.value);
    if (isNaN(userAnswer)) {
      customFeedbackEl.textContent = 'Entre un nombre valide (chiffres, virgule ou point).';
      customFeedbackEl.className = 'feedback info';
      return;
    }

    if (Generator.nearlyEqual(userAnswer, expected.answer)) {
      customFeedbackEl.textContent = 'Bravo, c\'est la bonne réponse !';
      customFeedbackEl.className = 'feedback success';
      customFromValueInput.disabled = true;
      customFromUnitSelect.disabled = true;
      customToUnitSelect.disabled = true;
      customToValueInput.disabled = true;
      btnCustomValidate.disabled = true;
      btnCustomSolve.disabled = true;
      advanceTimeoutId = setTimeout(resetCustomForm, 1400);
      safeBurstConfetti();
    } else {
      customToValueInput.value = '';
      customToValueInput.classList.add('wrong');
      customFeedbackEl.textContent = 'Ce n\'est pas la bonne réponse, réessaie ! (ou clique sur "Résoudre")';
      customFeedbackEl.className = 'feedback error';
      customToValueInput.focus();
    }
  }

  function solveOrContinueCustom() {
    if (!customRevealed) {
      const expected = getCustomExpectedAnswer();
      if (!expected) {
        customFeedbackEl.textContent = 'Indique d\'abord une valeur de départ valide.';
        customFeedbackEl.className = 'feedback info';
        return;
      }
      customToValueInput.value = Generator.formatNumberFR(expected.answer);
      customToValueInput.classList.remove('wrong');
      customToValueInput.classList.add('revealed');
      customFeedbackEl.textContent = 'Réponse : ' + Generator.formatNumberFR(expected.answer) + ' ' + expected.toLabel;
      customFeedbackEl.className = 'feedback info';

      customFromValueInput.disabled = true;
      customFromUnitSelect.disabled = true;
      customToUnitSelect.disabled = true;
      customToValueInput.disabled = true;
      btnCustomValidate.disabled = true;

      customRevealed = true;
      btnCustomSolve.textContent = 'Conversion suivante';
    } else {
      resetCustomForm();
    }
  }

  // ===================================================================
  //  Mode Tuto
  // ===================================================================

  function tutoFromCol() {
    return tutoConversion.fromRank + 1;
  }

  function tutoToCol() {
    return tutoConversion.toRank + 1;
  }

  function tutoDigitsInfo() {
    const intPart = Math.trunc(tutoConversion.fromValue);
    const intStr = String(intPart);
    const unitsDigit = intStr[intStr.length - 1];
    const tensDigit = intStr.length > 1 ? intStr[intStr.length - 2] : null;
    const decimalDigit = tutoConversion.fromValue.toFixed(1).split('.')[1];
    return { unitsDigit, tensDigit, decimalDigit };
  }

  function startTutoSession() {
    setTheme('tuto');
    showScreen('tuto');
    newTutoExample();
  }

  function newTutoExample() {
    clearPendingTimers();
    tutoConversion = Generator.generateTuto();
    DraftTable.resetTable(draftTableEl);

    tutoFromValueEl.textContent = Generator.formatNumberFR(tutoConversion.fromValue);
    tutoFromUnitEl.textContent = tutoConversion.fromLabel;
    tutoToUnitEl.textContent = tutoConversion.toLabel;
    tutoFromUnitEl.classList.remove('circle-mark-green');
    tutoToUnitEl.classList.remove('circle-mark-red');

    tutoAnswerInput.value = '';
    tutoAnswerInput.classList.remove('wrong');
    tutoSuccessEl.classList.add('hidden');
    tutoStack.classList.remove('shake-clear');

    renderTutoStep(1);
  }

  function renderTutoStep(step) {
    tutoStep = step;
    tutoFeedbackEl.textContent = '';
    tutoFeedbackEl.className = 'feedback';
    btnTutoPrev.classList.toggle('hidden', step === 1);

    if (step <= 4) {
      tutoAnswerInput.classList.add('hidden');
      btnTutoValidate.classList.add('hidden');
      btnTutoNext.classList.remove('hidden');
      tutoSuccessEl.classList.add('hidden');
      tutoStepTextEl.innerHTML = TUTO_STEP_TEXTS[step];

      if (step === 1) {
        // Rien à faire : la colonne de départ/arrivée et les flèches sont
        // montrées directement, on peut avancer tout de suite.
        DraftTable.setColumnArrow(tutoFromCol(), 'from');
        DraftTable.setColumnArrow(tutoToCol(), 'to');
        tutoFromUnitEl.classList.add('circle-mark-green');
        tutoToUnitEl.classList.add('circle-mark-red');
        btnTutoNext.disabled = false;
      } else {
        btnTutoNext.disabled = true;
        revalidateTutoStep();
      }
    } else {
      // Étape 5 : réponse finale
      tutoStepTextEl.innerHTML = '';
      btnTutoNext.classList.add('hidden');
      btnTutoValidate.classList.remove('hidden');
      btnTutoValidate.disabled = false;
      tutoAnswerInput.classList.remove('hidden');
      tutoAnswerInput.value = '';
      tutoAnswerInput.disabled = false;
      tutoAnswerInput.classList.remove('wrong');
      tutoAnswerInput.focus();
    }
  }

  function revalidateTutoStep() {
    if (!tutoConversion || tutoStep < 2 || tutoStep > 4) return;

    const info = tutoDigitsInfo();
    const fromCol = tutoFromCol();
    const toCol = tutoToCol();
    const requiredMap = {};

    if (tutoStep === 2) {
      requiredMap[fromCol] = info.unitsDigit;
    } else if (tutoStep === 3) {
      requiredMap[fromCol] = info.unitsDigit;
      if (info.tensDigit !== null) requiredMap[fromCol - 1] = info.tensDigit;
      requiredMap[fromCol + 1] = info.decimalDigit;
    } else if (tutoStep === 4) {
      const leftmostDigitCol = info.tensDigit !== null ? fromCol - 1 : fromCol;
      for (let c = toCol; c <= leftmostDigitCol - 1; c++) {
        requiredMap[c] = '0';
      }
    }

    let allCorrect = true;
    let anyWrongNonEmpty = false;

    Object.keys(requiredMap).forEach((colStr) => {
      const col = Number(colStr);
      const expected = requiredMap[colStr];
      const val = DraftTable.getCellValue(col);
      if (val === '') {
        allCorrect = false;
      } else if (val !== expected) {
        allCorrect = false;
        anyWrongNonEmpty = true;
        DraftTable.flashCellError(col);
      }
    });

    // Étape 3 : aucune autre case du tableau ne doit être remplie que celles
    // nécessaires à cette conversion.
    let hasExtraDigit = false;
    if (tutoStep === 3) {
      for (let c = 0; c < 9; c++) {
        if (requiredMap[c] !== undefined) continue;
        if (DraftTable.getCellValue(c) !== '') {
          hasExtraDigit = true;
          DraftTable.flashCellError(c);
        }
      }
    }

    btnTutoNext.disabled = !allCorrect || hasExtraDigit;

    if (hasExtraDigit) {
      tutoFeedbackEl.textContent = 'Il ne doit y avoir que les chiffres nécessaires à cette conversion.';
      tutoFeedbackEl.className = 'feedback error';
    } else if (anyWrongNonEmpty) {
      tutoFeedbackEl.textContent = 'Ce n\'est pas encore ça, réessaie.';
      tutoFeedbackEl.className = 'feedback error';
    } else {
      tutoFeedbackEl.textContent = '';
      tutoFeedbackEl.className = 'feedback';
    }
  }

  function onTutoNext() {
    if (tutoStep < 4) {
      renderTutoStep(tutoStep + 1);
    } else if (tutoStep === 4) {
      renderTutoStep(5);
    }
  }

  function onTutoPrev() {
    if (tutoStep > 1) {
      renderTutoStep(tutoStep - 1);
    }
  }

  function validateTutoAnswer() {
    const parsed = Generator.parseUserValue(tutoAnswerInput.value);

    if (isNaN(parsed)) {
      tutoFeedbackEl.textContent = 'Entre un nombre valide (chiffres, virgule ou point).';
      tutoFeedbackEl.className = 'feedback info';
      return;
    }

    if (Generator.nearlyEqual(parsed, tutoConversion.answer)) {
      tutoAnswerInput.disabled = true;
      btnTutoValidate.disabled = true;
      btnTutoPrev.classList.add('hidden');
      tutoFeedbackEl.textContent = '';
      tutoFeedbackEl.className = 'feedback';
      tutoSuccessEl.classList.remove('hidden');
      safeBurstConfetti();
    } else {
      tutoAnswerInput.value = '';
      tutoStack.classList.remove('shake-clear');
      void tutoStack.offsetWidth; // force le rejeu de l'animation
      tutoStack.classList.add('shake-clear');
      tutoFeedbackEl.textContent = 'Ce n\'est pas encore ça, réessaie.';
      tutoFeedbackEl.className = 'feedback error';
      tutoAnswerInput.focus();
    }
  }

  // --- Écouteurs d'événements : modes générés ---
  diffCards.forEach((card) => {
    card.addEventListener('click', () => {
      const diff = card.dataset.diff;
      if (diff === 'custom') {
        startCustomSession();
      } else if (diff === 'tuto') {
        startTutoSession();
      } else {
        startSession(diff);
      }
    });
  });

  btnBack.addEventListener('click', goHome);
  btnBackCustom.addEventListener('click', goHome);
  btnBackTuto.addEventListener('click', goHome);
  btnHome.addEventListener('click', goHome);
  btnRestart.addEventListener('click', () => startSession('evaluation'));

  btnHint.addEventListener('click', onHintClick);
  btnValidate.addEventListener('click', validateAnswer);
  btnNext.addEventListener('click', revealAndContinue);

  answerInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!btnNext.classList.contains('hidden') && !btnNext.disabled) {
        btnNext.click();
      } else if (!btnValidate.disabled) {
        btnValidate.click();
      }
    }
  });

  // --- Écouteurs d'événements : mode Custom ---
  customFromUnitSelect.addEventListener('change', onCustomFromUnitChange);
  customToUnitSelect.addEventListener('change', onCustomToUnitChange);
  btnCustomValidate.addEventListener('click', validateCustomAnswer);
  btnCustomSolve.addEventListener('click', solveOrContinueCustom);
  customToValueInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !btnCustomValidate.disabled) {
      e.preventDefault();
      btnCustomValidate.click();
    }
  });

  // --- Écouteurs d'événements : mode Tuto ---
  btnTutoPrev.addEventListener('click', onTutoPrev);
  btnTutoNext.addEventListener('click', onTutoNext);
  btnTutoValidate.addEventListener('click', validateTutoAnswer);
  btnTutoRetry.addEventListener('click', newTutoExample);
  btnTutoHome.addEventListener('click', goHome);
  tutoAnswerInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !btnTutoValidate.classList.contains('hidden')) {
      e.preventDefault();
      btnTutoValidate.click();
    }
  });
  // Revalidation en direct des étapes 2 à 4 à chaque saisie dans le tableau
  draftTableEl.addEventListener('input', () => {
    if (screens.tuto.classList.contains('active')) {
      revalidateTutoStep();
    }
  });

  // Écran de départ
  showScreen('home');
})();
