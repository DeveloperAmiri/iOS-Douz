/**
 * iOS-Douz — game logic tests
 * ---------------------------------------------------------------------------
 * Runs under plain Node.js, no test framework required:
 *
 *   node tests/game.test.js
 *
 * The suite exercises js/game.js directly, the same file the browser loads.
 */
'use strict';

var TicTacToe = require('../js/game.js');

var TicTacToeGame = TicTacToe.TicTacToeGame;
var findWinningLine = TicTacToe.findWinningLine;

var passed = 0;
var failures = [];

/** Minimal assertion helper with readable failure output. */
function check(description, condition) {
  if (condition) {
    passed += 1;
    console.log('  ✓ ' + description);
  } else {
    failures.push(description);
    console.log('  ✗ ' + description);
  }
}

function group(name) {
  console.log('\n' + name);
}

/** Build a game pre-loaded with a board, e.g. board(['X','O',null,...]). */
function board(squares, currentPlayer) {
  var game = new TicTacToeGame();
  game.loadBoard(squares, currentPlayer);
  return game;
}

/* ------------------------------------------------------------------ */
group('Fresh game');

var fresh = new TicTacToeGame();
check('X opens the round', fresh.currentPlayer === 'X');
check('the board has nine empty squares', fresh.board.length === 9 && fresh.board.every(function (v) { return v === null; }));
check('the round is in progress', fresh.isInProgress() === true);
check('scores start at zero', fresh.scores.X === 0 && fresh.scores.O === 0 && fresh.scores.draws === 0);

/* ------------------------------------------------------------------ */
group('Playing moves');

fresh.play(0);
check('the first move places an X', fresh.at(0) === 'X');
check('turn passes to O', fresh.currentPlayer === 'O');
fresh.play(4);
check('the second move places an O', fresh.at(4) === 'O');
check('turn passes back to X', fresh.currentPlayer === 'X');

var occupied = fresh.play(0);
check('an occupied square is rejected', occupied.played === false && occupied.reason === 'occupied');
var outOfBounds = fresh.play(42);
check('an out-of-bounds index is rejected', outOfBounds.played === false && outOfBounds.reason === 'out-of-bounds');
check('a rejected move does not change the turn', fresh.currentPlayer === 'X');

/* ------------------------------------------------------------------ */
group('Winning lines');

// X takes the three squares of a line; O answers with squares outside it.
// X moves first, so it wins on its third move while O only holds two marks —
// O can therefore never win or block by accident.
TicTacToe.WINNING_LINES.forEach(function (line) {
  var g = new TicTacToeGame();
  var freeSquares = [0, 1, 2, 3, 4, 5, 6, 7, 8].filter(function (index) {
    return line.indexOf(index) === -1;
  });

  g.play(line[0]);
  g.play(freeSquares[0]);
  g.play(line[1]);
  g.play(freeSquares[1]);
  var result = g.play(line[2]);

  check('X wins on line ' + line.join('-'),
    result.winner === 'X' && result.winningLine.join('-') === line.join('-'));
});

/* ------------------------------------------------------------------ */
group('Score handling');

var scored = new TicTacToeGame();
['X', 'O', 'X', 'O', 'X'].forEach(function (_, i) {
  scored.play([0, 3, 1, 4, 2][i]);      // X takes the top row, O the left column
});
check('a win increases the winner score', scored.scores.X === 1);
check('a win leaves the opponent score alone', scored.scores.O === 0);
check('the round is over after a win', scored.isOver() === true);
check('no further move is accepted after a win', scored.play(8).played === false && scored.play(8).reason === 'game-over');

scored.resetRound();
check('a new round keeps the score', scored.scores.X === 1);
check('a new round empties the board', scored.board.every(function (v) { return v === null; }));

scored.resetScores();
check('resetScores clears every counter', scored.scores.X === 0 && scored.scores.O === 0 && scored.scores.draws === 0);

/* ------------------------------------------------------------------ */
group('Draws');

// X O X / X X O / O X O — every square filled without three in a row.
var drawGame = board(['X', 'O', 'X', 'X', 'X', 'O', 'O', 'X', 'O'], 'X');
check('a full board without a line is not a win', findWinningLine(drawGame.board, 'X') === null);

var played = new TicTacToeGame();
[0, 1, 2, 4, 3, 5, 7, 6, 8].forEach(function (index) { played.play(index); });
// Resulting board: X O X / X O O / O X X
check('the round ends as a draw', played.isDraw === true && played.winner === null);
check('a draw increases the draw counter', played.scores.draws === 1);

/* ------------------------------------------------------------------ */
group('Undo');

var undoGame = new TicTacToeGame();
undoGame.play(0);
undoGame.play(3);
check('undo removes the last mark', undoGame.undo() === true && undoGame.at(3) === null);
check('undo restores the turn', undoGame.currentPlayer === 'O');
check('undo on an empty round returns false', (function () {
  var empty = new TicTacToeGame();
  return empty.undo() === false;
})());

var undoWin = new TicTacToeGame();
[0, 3, 1, 4, 2].forEach(function (index) { undoWin.play(index); });
check('undoing the winning move rolls the score back', (function () {
  undoWin.undo();
  return undoWin.scores.X === 0 && undoWin.winner === null && undoWin.isInProgress() === true;
})());

/* ------------------------------------------------------------------ */
group('Win detection helper');

check('finds a diagonal win', findWinningLine(['O', null, null, null, 'O', null, null, null, 'O'], 'O').join('-') === '0-4-8');
check('returns null when nobody won', findWinningLine(['X', 'O', null, null, null, null, null, null, null], 'X') === null);
check('loadBoard rejects a board of the wrong size', (function () {
  try {
    new TicTacToeGame().loadBoard([null, null], 'X');
    return false;
  } catch (error) {
    return true;
  }
})());

/* ------------------------------------------------------------------ */
console.log('\n' + (failures.length === 0
  ? 'All ' + passed + ' checks passed.'
  : failures.length + ' of ' + (passed + failures.length) + ' checks FAILED:\n  - ' + failures.join('\n  - ')));

process.exit(failures.length === 0 ? 0 : 1);
