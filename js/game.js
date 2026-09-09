/**
 * iOS-Douz — game logic
 * ---------------------------------------------------------------------------
 * This module is intentionally free of any DOM access so it can be unit
 * tested in plain Node.js (see tests/game.test.js) and reused by other
 * front ends.
 *
 * It is loaded with a classic <script> tag and exposes the global
 * `TicTacToe`. When `module.exports` exists (Node) the same object is
 * exported, which keeps a single source of truth for both environments.
 */
(function (global, factory) {
  'use strict';

  var api = factory();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;            // Node / unit tests
  }
  if (global) {
    global.TicTacToe = api;          // browser
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  /** Players. `null` in a board array means an empty square. */
  var PLAYER_X = 'X';
  var PLAYER_O = 'O';

  /** All eight winning lines, in board-index order. */
  var WINNING_LINES = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],   // rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8],   // columns
    [0, 4, 8], [2, 4, 6]               // diagonals
  ];

  /** Board size, kept as a constant so the logic is easy to read. */
  var SIZE = 3;
  var CELLS = SIZE * SIZE;

  /**
   * A single game session plus the running score across rounds.
   * @constructor
   */
  function TicTacToeGame() {
    this.scores = { X: 0, O: 0, draws: 0 };
    this.resetRound();
  }

  /** Start a fresh round. Scores are untouched — use resetScores() for that. */
  TicTacToeGame.prototype.resetRound = function () {
    this.board = new Array(CELLS).fill(null);
    this.currentPlayer = PLAYER_X;   // X always opens, like the classic game
    this.winner = null;
    this.winningLine = null;
    this.isDraw = false;
    this.moveHistory = [];
    return this;
  };

  /** Clear the running score for all three counters. */
  TicTacToeGame.prototype.resetScores = function () {
    this.scores = { X: 0, O: 0, draws: 0 };
    return this;
  };

  /** True while the round can still be played. */
  TicTacToeGame.prototype.isInProgress = function () {
    return this.winner === null && !this.isDraw;
  };

  /** True when the round is finished, either by a win or a draw. */
  TicTacToeGame.prototype.isOver = function () {
    return !this.isInProgress();
  };

  /** Read a square without exposing the internal array. */
  TicTacToeGame.prototype.at = function (index) {
    return this.board[index];
  };

  /**
   * Validate a move without applying it.
   * @param {number} index Board index 0..8.
   * @returns {{ok: boolean, reason: string|null}}
   */
  TicTacToeGame.prototype.canPlay = function (index) {
    if (!Number.isInteger(index) || index < 0 || index >= CELLS) {
      return { ok: false, reason: 'out-of-bounds' };
    }
    if (this.isOver()) {
      return { ok: false, reason: 'game-over' };
    }
    if (this.board[index] !== null) {
      return { ok: false, reason: 'occupied' };
    }
    return { ok: true, reason: null };
  };

  /**
   * Play a move for the current player.
   *
   * When the move ends the round the matching score counter is increased, so
   * the caller never has to remember to update it.
   *
   * @param {number} index Board index 0..8.
   * @returns {TicTacToeGame.MoveResult}
   */
  TicTacToeGame.prototype.play = function (index) {
    var check = this.canPlay(index);

    if (!check.ok) {
      return {
        played: false,
        reason: check.reason,
        index: index,
        player: null,
        winner: null,
        winningLine: null,
        isDraw: false,
        isOver: this.isOver()
      };
    }

    var player = this.currentPlayer;
    this.board[index] = player;
    this.moveHistory.push({ index: index, player: player });

    var line = findWinningLine(this.board, player);

    if (line) {
      this.winner = player;
      this.winningLine = line;
      this.scores[player] += 1;
    } else if (this.moveHistory.length === CELLS) {
      this.isDraw = true;
      this.scores.draws += 1;
    } else {
      this.currentPlayer = player === PLAYER_X ? PLAYER_O : PLAYER_X;
    }

    return {
      played: true,
      reason: null,
      index: index,
      player: player,
      winner: this.winner,
      winningLine: this.winningLine,
      isDraw: this.isDraw,
      isOver: this.isOver()
    };
  };

  /**
   * Undo the last move. Scores are rolled back too, which keeps the
   * scoreboard consistent when the player changes their mind.
   * @returns {boolean} True when a move was undone.
   */
  TicTacToeGame.prototype.undo = function () {
    var last = this.moveHistory.pop();
    if (!last) { return false; }

    // Remove the score this move may have awarded, then clear its side effects.
    if (this.winner === last.player) {
      this.scores[last.player] -= 1;
    } else if (this.isDraw) {
      this.scores.draws -= 1;
    }

    this.board[last.index] = null;
    this.currentPlayer = last.player;
    this.winner = null;
    this.winningLine = null;
    this.isDraw = false;
    return true;
  };

  /** Number of squares filled so far. */
  TicTacToeGame.prototype.filledCount = function () {
    return this.moveHistory.length;
  };

  /**
   * Find the winning line for `player`, or null when there is none.
   * Exported separately so it can be tested against arbitrary boards.
   *
   * @param {(string|null)[]} board Nine-square board.
   * @param {string} player 'X' or 'O'.
   * @returns {number[]|null} The three matching indices.
   */
  function findWinningLine(board, player) {
    for (var i = 0; i < WINNING_LINES.length; i += 1) {
      var line = WINNING_LINES[i];
      if (board[line[0]] === player &&
          board[line[1]] === player &&
          board[line[2]] === player) {
        return line.slice();
      }
    }
    return null;
  }

  /** Load a board from an array — used by the unit tests. */
  TicTacToeGame.prototype.loadBoard = function (board, currentPlayer) {
    if (!Array.isArray(board) || board.length !== CELLS) {
      throw new Error('loadBoard expects an array of ' + CELLS + ' squares');
    }
    this.board = board.slice();
    this.currentPlayer = currentPlayer || PLAYER_X;
    this.moveHistory = board
      .map(function (value, index) { return value ? { index: index, player: value } : null; })
      .filter(Boolean);
    this.winner = null;
    this.winningLine = null;
    this.isDraw = false;
    return this;
  };

  return {
    TicTacToeGame: TicTacToeGame,
    findWinningLine: findWinningLine,
    WINNING_LINES: WINNING_LINES,
    PLAYER_X: PLAYER_X,
    PLAYER_O: PLAYER_O,
    SIZE: SIZE,
    CELLS: CELLS
  };
});
