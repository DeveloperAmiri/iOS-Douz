/**
 * iOS-Douz — AI opponent
 * ---------------------------------------------------------------------------
 * Three difficulty levels, each a genuinely different algorithm:
 *
 *   easy    — uniform random moves. Beatable by anyone.
 *   medium  — the classic heuristic: take a win, block a loss, then prefer
 *             centre, corners and sides. Solid but exploitable.
 *   hard    — full-depth minimax with alpha–beta pruning and depth-aware
 *             scoring (it prefers faster wins and slower losses). Among
 *             equally perfect moves it picks randomly, so games vary, but
 *             it can never lose.
 *
 * The module is DOM-free: it is loaded by the browser after js/game.js and
 * exported to Node.js for unit tests.
 */
(function (global, factory) {
  'use strict';

  // In Node the sibling module is required; in the browser it is a global.
  var TicTacToe = (typeof module !== 'undefined' && module.exports && typeof require === 'function')
    ? require('./game.js')
    : global.TicTacToe;

  var api = factory(TicTacToe);

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;            // Node / unit tests
  }
  if (global) {
    global.DouzAi = api;             // browser
  }
})(typeof window !== 'undefined' ? window : globalThis, function (TicTacToe) {
  'use strict';

  var LINES = TicTacToe.WINNING_LINES;
  var CELLS = TicTacToe.CELLS;
  var OTHER = { X: 'O', O: 'X' };

  /** Indices of the empty squares. */
  function availableMoves(board) {
    var moves = [];
    for (var i = 0; i < CELLS; i += 1) {
      if (board[i] === null) { moves.push(i); }
    }
    return moves;
  }

  /** 'X' / 'O' when somebody has a line, 'draw' when full, else null. */
  function stateOf(board) {
    for (var i = 0; i < LINES.length; i += 1) {
      var line = LINES[i];
      var value = board[line[0]];
      if (value !== null && value === board[line[1]] && value === board[line[2]]) {
        return value;
      }
    }
    return availableMoves(board).length === 0 ? 'draw' : null;
  }

  /* ----------------------------------------------------------------------
   * Minimax with alpha–beta pruning (the "hard" brain)
   * ------------------------------------------------------------------- */

  /**
   * Negamax-style minimax. Scores are from `me`'s point of view:
   * a win is worth more the sooner it happens, a loss hurts less the later
   * it arrives, and a draw is zero.
   */
  function minimax(board, turn, me, depth, alpha, beta) {
    var state = stateOf(board);
    if (state === me) { return 10 - depth; }
    if (state === 'draw') { return 0; }
    if (state !== null) { return depth - 10; }   // the opponent won

    var moves = availableMoves(board);
    var best;
    var i;

    if (turn === me) {
      best = -Infinity;
      for (i = 0; i < moves.length; i += 1) {
        board[moves[i]] = turn;
        var scoreMax = minimax(board, OTHER[turn], me, depth + 1, alpha, beta);
        board[moves[i]] = null;
        if (scoreMax > best) { best = scoreMax; }
        if (best > alpha) { alpha = best; }
        if (beta <= alpha) { break; }            // prune
      }
      return best;
    }

    best = Infinity;
    for (i = 0; i < moves.length; i += 1) {
      board[moves[i]] = turn;
      var scoreMin = minimax(board, OTHER[turn], me, depth + 1, alpha, beta);
      board[moves[i]] = null;
      if (scoreMin < best) { best = scoreMin; }
      if (best < beta) { beta = best; }
      if (beta <= alpha) { break; }              // prune
    }
    return best;
  }

  /** All perfect moves for `me`, scored. */
  function scoredMoves(board, me) {
    var moves = availableMoves(board);
    var scored = [];
    for (var i = 0; i < moves.length; i += 1) {
      board[moves[i]] = me;
      var score = minimax(board, OTHER[me], me, 1, -Infinity, Infinity);
      board[moves[i]] = null;
      scored.push({ index: moves[i], score: score });
    }
    return scored;
  }

  function randomOf(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  /** A random empty square. */
  function randomMove(board) {
    return randomOf(availableMoves(board));
  }

  /* ----------------------------------------------------------------------
   * Medium: win, block, then positional play
   * ------------------------------------------------------------------- */

  /** The square that lets `player` complete a line right now, or null. */
  function immediateWin(board, player) {
    for (var l = 0; l < LINES.length; l += 1) {
      var line = LINES[l];
      var values = [board[line[0]], board[line[1]], board[line[2]]];
      var empties = [];
      var mine = 0;
      for (var i = 0; i < 3; i += 1) {
        if (values[i] === player) { mine += 1; }
        else if (values[i] === null) { empties.push(line[i]); }
      }
      if (mine === 2 && empties.length === 1) { return empties[0]; }
    }
    return null;
  }

  function mediumMove(board, me) {
    // 1. Win if we can.
    var win = immediateWin(board, me);
    if (win !== null) { return win; }

    // 2. Block the opponent's win.
    var block = immediateWin(board, OTHER[me]);
    if (block !== null) { return block; }

    // 3. Positional preference: centre, then corners, then sides.
    var empty = availableMoves(board);
    if (board[4] === null) { return 4; }
    var corners = [0, 2, 6, 8].filter(function (i) { return board[i] === null; });
    if (corners.length) { return randomOf(corners); }
    return randomOf(empty);
  }

  /* ----------------------------------------------------------------------
   * Hard: perfect play with variety among equal moves
   * ------------------------------------------------------------------- */

  function hardMove(board, me) {
    var scored = scoredMoves(board, me);
    var bestScore = -Infinity;
    for (var i = 0; i < scored.length; i += 1) {
      if (scored[i].score > bestScore) { bestScore = scored[i].score; }
    }
    var bestMoves = scored.filter(function (entry) { return entry.score === bestScore; });
    return randomOf(bestMoves).index;
  }

  /**
   * Choose the AI's move.
   *
   * @param {(string|null)[]} board Nine-square board (not mutated).
   * @param {string} me 'X' or 'O'.
   * @param {'easy'|'medium'|'hard'} [level='hard']
   * @returns {number} Board index 0..8.
   */
  function bestMove(board, me, level) {
    var working = board.slice();
    var moves = availableMoves(working);
    if (moves.length === 0) { return -1; }
    if (level === 'hard' && moves.length === CELLS) {
      // Opening move: centre or a corner is strongest; vary it.
      return randomOf([0, 2, 4, 6, 8]);
    }

    if (level === 'easy') { return randomMove(working); }
    if (level === 'medium') { return mediumMove(working, me); }
    return hardMove(working, me);
  }

  return {
    bestMove: bestMove,
    availableMoves: availableMoves,
    stateOf: stateOf,
    immediateWin: immediateWin,
    minimax: minimax,
    LEVELS: ['easy', 'medium', 'hard']
  };
});
