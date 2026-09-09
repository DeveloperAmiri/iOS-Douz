/**
 * iOS-Douz — interface layer
 * ---------------------------------------------------------------------------
 * Everything that touches the DOM lives here: rendering the board, the theme
 * switch, the alert and sheet dialogs, sound and haptics, and persistence.
 * The rules of the game itself live in js/game.js and are reused unchanged.
 *
 * The file is an IIFE so it never leaks globals except the ones it needs.
 */
(function () {
  'use strict';

  /* ----------------------------------------------------------------------
   * Small helpers
   * ------------------------------------------------------------------- */

  /** Shorthand for document.querySelector. */
  function $(selector) {
    return document.querySelector(selector);
  }

  /** Storage keys, namespaced so they never collide with other apps. */
  var STORAGE_PREFIX = 'ios-douz:';
  var KEY_THEME = STORAGE_PREFIX + 'appearance';
  var KEY_SOUND = STORAGE_PREFIX + 'sound';
  var KEY_HAPTICS = STORAGE_PREFIX + 'haptics';
  var KEY_SCORES = STORAGE_PREFIX + 'scores';

  /**
   * Read a value from localStorage, tolerating browsers where storage is
   * unavailable (private mode, embedded web views).
   */
  function readStore(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (error) {
      return null;
    }
  }

  /** Write a value to localStorage, ignoring failures. */
  function writeStore(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch (error) {
      /* Storage is not available — the app still works for this session. */
    }
  }

  /* ----------------------------------------------------------------------
   * Elements
   * ------------------------------------------------------------------- */

  var elements = {
    board: $('#board'),
    winLine: $('#winLine'),
    winLinePath: $('#winLinePath'),
    cells: Array.prototype.slice.call(document.querySelectorAll('.cell')),
    status: $('#status'),
    turnThumb: $('#turnThumb'),
    segmentX: $('#segmentX'),
    segmentO: $('#segmentO'),
    turnHint: $('#turnHint'),
    boardHint: $('#boardHint'),
    scoreX: $('#scoreX'),
    scoreO: $('#scoreO'),
    scoreDraws: $('#scoreDraws'),
    scoreXValue: $('#scoreXValue'),
    scoreOValue: $('#scoreOValue'),
    scoreDrawsValue: $('#scoreDrawsValue'),
    newGameButton: $('#newGameButton'),
    newRoundButton: $('#newRoundButton'),
    resetScoresButton: $('#resetScoresButton'),
    infoButton: $('#infoButton'),
    soundSwitch: $('#soundSwitch'),
    hapticsSwitch: $('#hapticsSwitch'),
    appearanceControl: document.querySelector('[data-appearance="auto"]').closest('.segmented-control'),
    appearanceThumb: $('#appearanceThumb'),
    alertBackdrop: $('#alertBackdrop'),
    alertTitle: $('#alertTitle'),
    alertMessage: $('#alertMessage'),
    alertActions: document.querySelector('.alert__actions'),
    sheetBackdrop: $('#sheetBackdrop'),
    sheetCloseButton: $('#sheetCloseButton')
  };

  /* ----------------------------------------------------------------------
   * Icons — expand every [data-icon] placeholder with inline SVG
   * ------------------------------------------------------------------- */

  function injectIcons(root) {
    var placeholders = (root || document).querySelectorAll('[data-icon]');
    Array.prototype.forEach.call(placeholders, function (placeholder) {
      var markup = window.Icons.get(placeholder.getAttribute('data-icon'));
      if (markup) {
        placeholder.innerHTML = markup;
      }
    });
  }

  /* ----------------------------------------------------------------------
   * Appearance — auto / light / dark, remembered between visits
   * ------------------------------------------------------------------- */

  var darkMedia = window.matchMedia('(prefers-color-scheme: dark)');
  var appearance = readStore(KEY_THEME) || 'auto';

  /** Resolve the saved preference into the theme actually applied. */
  function resolveTheme() {
    if (appearance === 'light' || appearance === 'dark') {
      return appearance;
    }
    return darkMedia.matches ? 'dark' : 'light';
  }

  /** Apply the current theme to <html> so the CSS tokens switch over. */
  function applyTheme() {
    document.documentElement.setAttribute('data-theme', resolveTheme());
    updateAppearanceControl();
  }

  /** Move the segmented-control thumb and update aria state. */
  function updateAppearanceControl() {
    var items = elements.appearanceControl.querySelectorAll('[data-appearance]');
    Array.prototype.forEach.call(items, function (item) {
      var selected = item.getAttribute('data-appearance') === appearance;
      item.classList.toggle('is-selected', selected);
      item.setAttribute('aria-checked', String(selected));
    });
    moveThumb(elements.appearanceControl, elements.appearanceThumb, '[data-appearance="' + appearance + '"]');
  }

  /** Follow the OS while the preference is "auto". */
  function onSystemThemeChange() {
    if (appearance === 'auto') {
      applyTheme();
    }
  }

  if (typeof darkMedia.addEventListener === 'function') {
    darkMedia.addEventListener('change', onSystemThemeChange);
  } else if (typeof darkMedia.addListener === 'function') {
    darkMedia.addListener(onSystemThemeChange);   // Safari < 14
  }

  /* ----------------------------------------------------------------------
   * Segmented-control thumbs — positioned in JavaScript so the control works
   * with any number of segments and any label length.
   * ------------------------------------------------------------------- */

  function moveThumb(control, thumb, selectedSelector) {
    var selected = control.querySelector(selectedSelector);
    if (!selected || !thumb) { return; }
    thumb.style.width = selected.offsetWidth + 'px';
    thumb.style.transform = 'translateX(' + selected.offsetLeft + 'px)';
  }

  function updateTurnControl() {
    var isX = game.currentPlayer === TicTacToe.PLAYER_X;
    elements.segmentX.classList.toggle('is-selected', isX);
    elements.segmentO.classList.toggle('is-selected', !isX);
    moveThumb(
      elements.turnThumb.parentElement,
      elements.turnThumb,
      isX ? '#segmentX' : '#segmentO'
    );
  }

  /* ----------------------------------------------------------------------
   * Sound — tiny Web Audio blips, no audio files to ship
   * ------------------------------------------------------------------- */

  var Sound = (function () {
    var context = null;

    /** Lazily create the audio context, as browsers require a gesture. */
    function ensureContext() {
      if (context) { return context; }
      var AudioCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtor) { return null; }
      context = new AudioCtor();
      return context;
    }

    /**
     * Play one short tone.
     * @param {number} frequency Hertz.
     * @param {number} delay Seconds from now.
     * @param {number} duration Seconds.
     * @param {OscillatorType} type Wave shape.
     */
    function tone(frequency, delay, duration, type) {
      if (!soundEnabled) { return; }
      var ctx = ensureContext();
      if (!ctx) { return; }
      if (ctx.state === 'suspended') { ctx.resume(); }

      var oscillator = ctx.createOscillator();
      var gain = ctx.createGain();
      var start = ctx.currentTime + delay;

      oscillator.type = type || 'sine';
      oscillator.frequency.setValueAtTime(frequency, start);

      // Short attack and release so the blip never clicks.
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.18, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

      oscillator.connect(gain).connect(ctx.destination);
      oscillator.start(start);
      oscillator.stop(start + duration + 0.02);
    }

    return {
      move: function () { tone(660, 0, 0.09, 'triangle'); },
      invalid: function () { tone(180, 0, 0.12, 'square'); },
      win: function () {
        tone(523.25, 0, 0.14, 'sine');
        tone(659.25, 0.11, 0.14, 'sine');
        tone(783.99, 0.22, 0.22, 'sine');
      },
      draw: function () {
        tone(392, 0, 0.16, 'sine');
        tone(311.13, 0.14, 0.24, 'sine');
      }
    };
  })();

  /* ----------------------------------------------------------------------
   * Haptics — the Vibration API where it exists (Android Chrome), silently
   * ignored on platforms without it.
   * ------------------------------------------------------------------- */

  var Haptics = {
    tap: function () { vibrate(10); },
    error: function () { vibrate([0, 18, 40, 18]); },
    win: function () { vibrate([0, 20, 60, 20, 60, 30]); }
  };

  function vibrate(pattern) {
    if (hapticsEnabled && navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  }

  /* ----------------------------------------------------------------------
   * Preferences
   * ------------------------------------------------------------------- */

  var soundEnabled = readStore(KEY_SOUND) !== 'false';
  var hapticsEnabled = readStore(KEY_HAPTICS) !== 'false';

  function setSwitch(button, isOn) {
    button.setAttribute('aria-checked', String(isOn));
  }

  /* ----------------------------------------------------------------------
   * The game
   * ------------------------------------------------------------------- */

  var game = new TicTacToe.TicTacToeGame();

  /** Restore the running score from a previous visit. */
  function restoreScores() {
    var raw = readStore(KEY_SCORES);
    if (!raw) { return; }
    try {
      var parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        game.scores.X = Number(parsed.X) || 0;
        game.scores.O = Number(parsed.O) || 0;
        game.scores.draws = Number(parsed.draws) || 0;
      }
    } catch (error) {
      /* Corrupt value — start from zero. */
    }
  }

  function persistScores() {
    writeStore(KEY_SCORES, JSON.stringify(game.scores));
  }

  /* ----------------------------------------------------------------------
   * Rendering
   * ------------------------------------------------------------------- */

  /** SVG markup for a player's mark, with the length needed for the draw-on
   *  animation supplied as a custom property. */
  function markMarkup(player) {
    if (player === TicTacToe.PLAYER_X) {
      // Two diagonals of 15.84 units each.
      return '<svg class="mark" viewBox="0 0 24 24" style="--mark-length:32" aria-hidden="true">' +
        '<path class="mark__stroke mark__stroke--x" d="M6.4 6.4 17.6 17.6M17.6 6.4 6.4 17.6"/></svg>';
    }
    // Circle of radius 6: circumference is about 37.7.
    return '<svg class="mark" viewBox="0 0 24 24" style="--mark-length:38" aria-hidden="true">' +
      '<circle class="mark__stroke mark__stroke--o" cx="12" cy="12" r="6"/></svg>';
  }

  /** Describe a square in words for assistive technology. */
  function cellDescription(index, value) {
    var row = Math.floor(index / TicTacToe.SIZE) + 1;
    var column = (index % TicTacToe.SIZE) + 1;
    var position = 'Row ' + row + ', column ' + column;
    var content = value ? 'Player ' + value : 'empty';
    return position + ': ' + content;
  }

  /** Paint the whole board from the model. */
  function renderBoard() {
    elements.board.removeAttribute('data-winner');
    elements.cells.forEach(function (cell, index) {
      var value = game.at(index);
      cell.classList.toggle('is-filled', Boolean(value));
      cell.classList.toggle('is-winning', false);
      cell.classList.remove('is-shaking');
      cell.disabled = game.isOver() || Boolean(value);
      cell.setAttribute('aria-label', cellDescription(index, value));
      cell.innerHTML = value ? markMarkup(value) : '';
    });
    hideWinLine();
  }

  /** Put a single mark on the board without repainting everything. */
  function renderMove(index, player) {
    var cell = elements.cells[index];
    cell.classList.add('is-filled');
    cell.disabled = true;
    cell.setAttribute('aria-label', cellDescription(index, player));
    cell.innerHTML = markMarkup(player);
  }

  /** Refresh the scoreboard, bumping the counter that just changed. */
  function renderScores(changed) {
    var map = { X: elements.scoreXValue, O: elements.scoreOValue, draws: elements.scoreDrawsValue };
    Object.keys(map).forEach(function (key) {
      var node = map[key];
      if (node.textContent !== String(game.scores[key])) {
        node.textContent = String(game.scores[key]);
      }
      if (changed === key) {
        node.classList.remove('is-bumped');
        // Force a reflow so the animation restarts on repeat wins.
        void node.offsetWidth;
        node.classList.add('is-bumped');
      }
    });
  }

  /** Highlight the winning player's card with colour *and* a text change. */
  function renderWinnerCard(winner) {
    elements.scoreX.classList.toggle('is-winner', winner === TicTacToe.PLAYER_X);
    elements.scoreO.classList.toggle('is-winner', winner === TicTacToe.PLAYER_O);
    elements.scoreDraws.classList.toggle('is-winner', false);

    var unitX = elements.scoreX.querySelector('.score-card__unit');
    var unitO = elements.scoreO.querySelector('.score-card__unit');
    if (unitX) { unitX.textContent = winner === TicTacToe.PLAYER_X ? 'winner' : 'wins'; }
    if (unitO) { unitO.textContent = winner === TicTacToe.PLAYER_O ? 'winner' : 'wins'; }
  }

  /** Update the caption under the segmented control. */
  function renderHint() {
    if (game.winner) {
      elements.turnHint.textContent = 'Player ' + game.winner + ' wins the round';
    } else if (game.isDraw) {
      elements.turnHint.textContent = 'Draw — nobody scored';
    } else if (game.filledCount() === 0) {
      elements.turnHint.textContent = 'Tap a square to play';
    } else {
      elements.turnHint.textContent = 'Player ' + game.currentPlayer + ', your turn';
    }

    elements.boardHint.textContent = game.isOver()
      ? 'Press New Game to play another round'
      : 'Three in a row wins';
  }

  /** Announce a change to screen readers without moving focus. */
  function announce(message) {
    elements.status.textContent = message;
  }

  /** Paint every part of the interface from the model. */
  function render(changedScore) {
    renderBoard();
    updateTurnControl();
    renderScores(changedScore);
    renderWinnerCard(game.winner);
    renderHint();
  }

  /* ----------------------------------------------------------------------
   * Winning line
   * ------------------------------------------------------------------- */

  /**
   * Draw a line through the three winning squares. The geometry is measured
   * from the real layout, so it stays correct at any screen size.
   */
  /**
   * @param {number[]} line The three winning indices.
   * @param {boolean} [replay=true] Whether to restart the draw-on animation.
   *        Window resizes only need the geometry refreshed (replay=false),
   *        otherwise the line would re-animate on every drag of the window.
   */
  function showWinLine(line, replay) {
    if (replay === undefined) { replay = true; }
    var boardRect = elements.board.getBoundingClientRect();
    var first = elements.cells[line[0]].getBoundingClientRect();
    var last = elements.cells[line[line.length - 1]].getBoundingClientRect();

    var x1 = first.left - boardRect.left + first.width / 2;
    var y1 = first.top - boardRect.top + first.height / 2;
    var x2 = last.left - boardRect.left + last.width / 2;
    var y2 = last.top - boardRect.top + last.height / 2;

    // Stretch the line a little past the outer squares for a drawn feel.
    var dx = x2 - x1;
    var dy = y2 - y1;
    var length = Math.sqrt(dx * dx + dy * dy) || 1;
    var overhang = Math.min(18, length * 0.08);
    x1 -= (dx / length) * overhang;
    y1 -= (dy / length) * overhang;
    x2 += (dx / length) * overhang;
    y2 += (dy / length) * overhang;

    elements.winLine.setAttribute('viewBox', '0 0 ' + boardRect.width + ' ' + boardRect.height);
    elements.winLine.style.width = boardRect.width + 'px';
    elements.winLine.style.height = boardRect.height + 'px';
    elements.winLinePath.setAttribute('d', 'M' + x1 + ' ' + y1 + 'L' + x2 + ' ' + y2);
    elements.winLinePath.style.setProperty('--line-length', Math.ceil(length + overhang * 2));

    // Restart the draw-on animation only for a fresh win.
    if (replay) {
      elements.winLine.classList.remove('is-visible');
      void elements.winLine.getBoundingClientRect();
      elements.winLine.classList.add('is-visible');
    } else if (!elements.winLine.classList.contains('is-visible')) {
      elements.winLine.classList.add('is-visible');
    }
  }

  function hideWinLine() {
    elements.winLine.classList.remove('is-visible');
    elements.winLinePath.setAttribute('d', '');
  }

  /* ----------------------------------------------------------------------
   * Alert — iOS UIAlertController replacement
   * ------------------------------------------------------------------- */

  var lastFocusedElement = null;

  /**
   * Show the alert and resolve with the chosen action key.
   *
   * @param {Object} options
   * @param {string} options.title Bold headline.
   * @param {string} options.message Supporting line.
   * @param {{key: string, label: string, style?: string}[]} options.actions
   * @returns {Promise<string>} The key of the action the user picked.
   */
  function showAlert(options) {
    return new Promise(function (resolve) {
      lastFocusedElement = document.activeElement;

      elements.alertTitle.textContent = options.title;
      elements.alertMessage.textContent = options.message;
      elements.alertActions.innerHTML = '';

      options.actions.forEach(function (action) {
        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'alert__action';
        button.dataset.action = action.key;   // keep the key on the element for styling and tests
        if (action.style === 'bold') { button.classList.add('alert__action--bold'); }
        if (action.style === 'destructive') { button.classList.add('alert__action--destructive'); }
        button.textContent = action.label;
        button.addEventListener('click', function () { close(action.key); });
        elements.alertActions.appendChild(button);
      });

      elements.alertBackdrop.hidden = false;
      elements.alertBackdrop.classList.remove('is-closing');

      var buttons = elements.alertActions.querySelectorAll('.alert__action');
      if (buttons.length) { buttons[buttons.length - 1].focus(); }
      document.addEventListener('keydown', onAlertKeydown);

      function close(key) {
        document.removeEventListener('keydown', onAlertKeydown);
        elements.alertBackdrop.hidden = true;
        if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
          lastFocusedElement.focus();
        }
        resolve(key);
      }

      function onAlertKeydown(event) {
        if (event.key === 'Escape') {
          event.preventDefault();
          close('dismiss');
          return;
        }
        if (event.key === 'Tab') { trapFocus(event, elements.alertBackdrop); }
      }
    });
  }

  /** Keep Tab focus inside a dialog, the way iOS keeps it inside an alert. */
  function trapFocus(event, container) {
    var focusable = container.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (!focusable.length) { return; }
    var first = focusable[0];
    var last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  /* ----------------------------------------------------------------------
   * Sheet — slides up from the bottom
   * ------------------------------------------------------------------- */

  function openSheet() {
    lastFocusedElement = document.activeElement;
    elements.sheetBackdrop.hidden = false;
    elements.sheetBackdrop.classList.remove('is-closing');
    elements.sheetCloseButton.focus();
    document.addEventListener('keydown', onSheetKeydown);
  }

  function closeSheet() {
    // Play the reverse animation, then hide the element.
    elements.sheetBackdrop.classList.add('is-closing');
    document.removeEventListener('keydown', onSheetKeydown);
    window.setTimeout(function () {
      elements.sheetBackdrop.hidden = true;
      elements.sheetBackdrop.classList.remove('is-closing');
      if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
        lastFocusedElement.focus();
      }
    }, 260);
  }

  function onSheetKeydown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeSheet();
    } else if (event.key === 'Tab') {
      trapFocus(event, elements.sheetBackdrop);
    }
  }

  /* ----------------------------------------------------------------------
   * Interaction
   * ------------------------------------------------------------------- */

  /** Handle a tap on a square. */
  function onCellClick(index) {
    var result = game.play(index);

    if (!result.played) {
      if (result.reason === 'occupied') {
        // Feedback for a square that is already taken.
        var cell = elements.cells[index];
        cell.classList.remove('is-shaking');
        void cell.offsetWidth;
        cell.classList.add('is-shaking');
        Sound.invalid();
        Haptics.error();
        announce('That square is already taken');
      }
      return;
    }

    renderMove(result.index, result.player);
    Sound.move();
    Haptics.tap();

    if (result.winner) {
      elements.cells.forEach(function (cell, cellIndex) {
        if (result.winningLine.indexOf(cellIndex) !== -1) {
          cell.classList.add('is-winning');
        }
      });
      // Colour the winning line and tints with the winner, not a fixed hue.
      elements.board.setAttribute('data-winner', result.winner);
      showWinLine(result.winningLine);
      renderScores(result.player);
      renderWinnerCard(result.winner);
      renderHint();
      updateTurnControl();
      persistScores();
      Sound.win();
      Haptics.win();
      announce('Player ' + result.winner + ' wins. Score: X ' + game.scores.X +
        ', O ' + game.scores.O + ', draws ' + game.scores.draws);

      window.setTimeout(function () {
        showAlert({
          title: 'Player ' + result.winner + ' wins',
          message: 'Three in a row. The score is X ' + game.scores.X + ' – ' + game.scores.O + '.',
          actions: [
            { key: 'review', label: 'Review board' },
            { key: 'play', label: 'Play again', style: 'bold' }
          ]
        }).then(function (choice) {
          if (choice !== 'review') { startNewRound(); }
        });
      }, 900);
      return;
    }

    if (result.isDraw) {
      renderScores('draws');
      renderHint();
      persistScores();
      Sound.draw();
      announce('Draw. The score is X ' + game.scores.X + ', O ' + game.scores.O +
        ', draws ' + game.scores.draws);

      window.setTimeout(function () {
        showAlert({
          title: 'Draw',
          message: 'Every square is taken and nobody scored.',
          actions: [
            { key: 'review', label: 'Review board' },
            { key: 'play', label: 'Play again', style: 'bold' }
          ]
        }).then(function (choice) {
          if (choice !== 'review') { startNewRound(); }
        });
      }, 700);
      return;
    }

    updateTurnControl();
    renderHint();
    announce('Player ' + result.player + ' played. Player ' + game.currentPlayer + ' to play.');
  }

  /** Clear the board for another round, keeping the score. */
  function startNewRound() {
    game.resetRound();
    render();
    announce('New round. Player X to play.');
    elements.cells[0].focus();
  }

  /** Ask before clearing the score, using the same alert component. */
  function confirmResetScores() {
    showAlert({
      title: 'Reset scores',
      message: 'This clears the win count for both players and the draw count.',
      actions: [
        { key: 'cancel', label: 'Cancel' },
        { key: 'reset', label: 'Reset scores', style: 'destructive' }
      ]
    }).then(function (choice) {
      if (choice !== 'reset') { return; }
      game.resetScores();
      persistScores();
      renderScores();
      renderWinnerCard(game.isOver() ? game.winner : null);
      announce('Scores reset to zero.');
    });
  }

  /**
   * Arrow-key navigation across the board, so the game is fully playable
   * without a pointer.
   */
  function onBoardKeydown(event) {
    var index = elements.cells.indexOf(document.activeElement);
    if (index === -1) { return; }

    var size = TicTacToe.SIZE;
    var next = index;

    if (event.key === 'ArrowRight') { next = index % size === size - 1 ? index : index + 1; }
    else if (event.key === 'ArrowLeft') { next = index % size === 0 ? index : index - 1; }
    else if (event.key === 'ArrowDown') { next = index + size < size * size ? index + size : index; }
    else if (event.key === 'ArrowUp') { next = index - size >= 0 ? index - size : index; }
    else { return; }

    event.preventDefault();
    elements.cells[next].focus();
  }

  /* ----------------------------------------------------------------------
   * Wiring
   * ------------------------------------------------------------------- */

  function bindEvents() {
    elements.cells.forEach(function (cell, index) {
      cell.addEventListener('click', function () { onCellClick(index); });
    });

    elements.board.addEventListener('keydown', onBoardKeydown);

    elements.newGameButton.addEventListener('click', startNewRound);
    elements.newRoundButton.addEventListener('click', startNewRound);
    elements.resetScoresButton.addEventListener('click', confirmResetScores);
    elements.infoButton.addEventListener('click', openSheet);
    elements.sheetCloseButton.addEventListener('click', closeSheet);

    elements.sheetBackdrop.addEventListener('click', function (event) {
      if (event.target === elements.sheetBackdrop) { closeSheet(); }
    });

    // Appearance segmented control.
    elements.appearanceControl.addEventListener('click', function (event) {
      var item = event.target.closest('[data-appearance]');
      if (!item) { return; }
      appearance = item.getAttribute('data-appearance');
      writeStore(KEY_THEME, appearance);
      applyTheme();
    });

    // Sound and haptics switches.
    elements.soundSwitch.addEventListener('click', function () {
      soundEnabled = !soundEnabled;
      setSwitch(elements.soundSwitch, soundEnabled);
      writeStore(KEY_SOUND, String(soundEnabled));
      if (soundEnabled) { Sound.move(); }   // audible confirmation
    });

    elements.hapticsSwitch.addEventListener('click', function () {
      hapticsEnabled = !hapticsEnabled;
      setSwitch(elements.hapticsSwitch, hapticsEnabled);
      writeStore(KEY_HAPTICS, String(hapticsEnabled));
      if (hapticsEnabled) { Haptics.tap(); }
    });

    // Redraw the winning line and the thumbs when the layout changes.
    window.addEventListener('resize', function () {
      if (game.winningLine) { showWinLine(game.winningLine, false); }
      updateTurnControl();
      updateAppearanceControl();
    });
  }

  /* ----------------------------------------------------------------------
   * Boot
   * ------------------------------------------------------------------- */

  function init() {
    injectIcons(document);
    applyTheme();
    setSwitch(elements.soundSwitch, soundEnabled);
    setSwitch(elements.hapticsSwitch, hapticsEnabled);
    restoreScores();
    render();
    bindEvents();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
