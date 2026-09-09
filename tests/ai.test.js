/**
 * iOS-Douz — AI tests
 * ---------------------------------------------------------------------------
 * Runs under plain Node.js, no test framework required:
 *
 *   node tests/ai.test.js
 *
 * Verifies that each difficulty behaves as advertised — most importantly
 * that the hard (minimax + alpha–beta) brain can never lose.
 */
'use strict';

var Ai = require('../js/ai.js');

var passed = 0;
var failures = [];

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

function randomOf(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function emptyBoard() {
  return [null, null, null, null, null, null, null, null, null];
}

/** Play a full game; returns 'X' | 'O' | 'draw'. */
function playGame(aiPlayer, aiLevel, aiFirst) {
  var board = emptyBoard();
  var turn = 'X';

  while (Ai.stateOf(board) === null) {
    var move;
    if (turn === aiPlayer) {
      move = Ai.bestMove(board, aiPlayer, aiLevel);
    } else {
      move = randomOf(Ai.availableMoves(board));
    }
    board[move] = turn;
    turn = turn === 'X' ? 'O' : 'X';
  }
  void aiFirst;   // first move is implied by the aiPlayer parity
  return Ai.stateOf(board);
}

/* ------------------------------------------------------------------ */
group('Move legality');

check('bestMove returns an empty square', (function () {
  var board = emptyBoard();
  board[0] = 'X';
  var move = Ai.bestMove(board, 'O', 'hard');
  return board[move] === null;
})());

check('bestMove on a full board returns -1',
  Ai.bestMove(['X', 'O', 'X', 'X', 'X', 'O', 'O', 'X', 'O'], 'X', 'hard') === -1);

check('the opening move is a corner or the centre',
  [0, 2, 4, 6, 8].indexOf(Ai.bestMove(emptyBoard(), 'X', 'hard')) !== -1);

/* ------------------------------------------------------------------ */
group('Tactics (hard)');

check('takes an immediate win',
  Ai.bestMove(['X', 'X', null, 'O', 'O', null, null, null, null], 'X', 'hard') === 2);

check('blocks an immediate loss',
  Ai.bestMove(['X', 'X', null, 'O', null, null, null, null, null], 'O', 'hard') === 2);

check('blocks a diagonal threat',
  Ai.bestMove(['X', null, null, null, 'X', null, null, null, null], 'O', 'hard') === 8);

check('prefers winning over blocking',
  Ai.bestMove(['O', 'O', null, 'X', 'X', null, null, null, null], 'O', 'hard') === 2);

/* ------------------------------------------------------------------ */
group('Tactics (medium)');

check('medium takes an immediate win',
  Ai.bestMove(['O', 'O', null, 'X', null, null, null, null, null], 'O', 'medium') === 2);

check('medium blocks an immediate loss',
  Ai.bestMove(['X', 'X', null, 'O', null, null, null, null, null], 'O', 'medium') === 2);

check('medium opens with the centre when free',
  Ai.bestMove(emptyBoard(), 'X', 'medium') === 4);

/* ------------------------------------------------------------------ */
group('Easy plays legally');

check('easy always picks an empty square', (function () {
  for (var i = 0; i < 50; i += 1) {
    var board = emptyBoard();
    board[0] = 'X'; board[3] = 'O';
    var move = Ai.bestMove(board, 'X', 'easy');
    if (board[move] !== null) { return false; }
  }
  return true;
})());

/* ------------------------------------------------------------------ */
group('Hard never loses');

var randomWins = 0;
var hardWins = 0;
var GAMES = 200;
for (var i = 0; i < GAMES; i += 1) {
  var result = playGame('X', 'hard', i % 2 === 0);
  if (result === 'O') { randomWins += 1; }
  if (result === 'X') { hardWins += 1; }
}
check('random never beats hard in ' + GAMES + ' games (random wins: ' + randomWins + ')',
  randomWins === 0);
check('hard scores wins against random (' + hardWins + ' wins)', hardWins > 0);

var hardAsSecondLosses = 0;
for (var j = 0; j < 100; j += 1) {
  if (playGame('O', 'hard', false) === 'X') { hardAsSecondLosses += 1; }
}
check('hard as second player never loses (losses: ' + hardAsSecondLosses + ')',
  hardAsSecondLosses === 0);

/* ------------------------------------------------------------------ */
group('Perfect play draws perfect play');

var draws = 0;
var MIRROR = 30;
for (var k = 0; k < MIRROR; k += 1) {
  var board = emptyBoard();
  var turn = 'X';
  while (Ai.stateOf(board) === null) {
    var move = Ai.bestMove(board, turn, 'hard');
    board[move] = turn;
    turn = turn === 'X' ? 'O' : 'X';
  }
  if (Ai.stateOf(board) === 'draw') { draws += 1; }
}
check('hard vs hard is always a draw (' + draws + '/' + MIRROR + ')', draws === MIRROR);

/* ------------------------------------------------------------------ */
console.log('\n' + (failures.length === 0
  ? 'All ' + passed + ' AI checks passed.'
  : failures.length + ' of ' + (passed + failures.length) + ' AI checks FAILED:\n  - ' + failures.join('\n  - ')));

process.exit(failures.length === 0 ? 0 : 1);
