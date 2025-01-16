import { Logger } from '@nestjs/common';

export const COLS = 10;
export const ROWS = 20;

const Collision = {
  NONE: 0,
  LEFT: 1,
  RIGHT: 2,
  BOTTOM: 3,
  BLOCK: 4,
};

export default class Player {
  constructor(socket, name) {
    this.socket = socket;
    this.name = name;
    this.room = null;
    this.isMaster = false;

    this.logger = new Logger(`Player ${name}`);
    this.logger.log(`Player Created`);
  }

  initGame() {
    clearInterval(this.fallInterval);
    this.currentPiece = null;
    this.alive = true;
    this.board = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    this.spectrum = Array(COLS).fill(0);
    this.isSpin = false;
    this.spinPenalty = 0;
    this.sendUpdate();
    this.updateSpectrum();
    const timeout = setTimeout(() => {
      this.requestPieceAndMakeItFall();
      clearTimeout(timeout);
    }, 1000);
  }

  async requestPieceAndMakeItFall() {
    if (!this.alive) return;

    await this.removeLines();
    this.currentPiece = this.requestPiece();

    if (this.checkCollision() === Collision.BLOCK) {
      this.alive = false;
      this.logger.log('Game Over');
      while (this.checkCollision() === Collision.BLOCK) this.currentPiece.y--;
      this.drawPiece();
      this.updateSpectrum();
      return this.checkEndOfGame();
    }

    this.drawPiece();
    this.launchFallInterval();
  }

  makePieceFall(dontLock = false) {
    if (!this.alive || !this.room.inGame)
      return clearInterval(this.fallInterval);

    this.clearPiece();
    this.currentPiece.y++;

    if (this.checkCollision() !== Collision.NONE) {
      if (dontLock) {
        this.currentPiece.y--;
        this.launchFallInterval();
        return;
      }
      return this.lockPiece();
    }
    this.isSpin = false;

    this.drawPiece();
  }

  launchFallInterval() {
    clearInterval(this.fallInterval);
    this.fallInterval = setInterval(
      () => this.makePieceFall(),
      1000 / (1 + this.spinPenalty),
    );
  }

  makeMove(move) {
    // prettier-ignore
    if (!this.alive || this.inRemoveLines || !this.room.inGame || !this.currentPiece) return;

    this.clearPiece();

    const oldX = this.currentPiece.x;
    const oldY = this.currentPiece.y;

    switch (move) {
      case 'left':
        this.currentPiece.x--;
        if (this.checkCollision() !== Collision.NONE) this.currentPiece.x++;
        break;
      case 'right':
        this.currentPiece.x++;
        if (this.checkCollision() !== Collision.NONE) this.currentPiece.x--;
        break;
      case 'rotation':
        this.isSpin = this.currentPiece.rotate(() => this.checkCollision());
        if (!this.isSpin && this.currentPiece.type === 'T') this.checkTSpin();
        break;
      case 'soft drop':
        this.makePieceFall(true);
        break;
      case 'hard drop':
        while (this.checkCollision() === Collision.NONE) this.currentPiece.y++;
        this.lockPiece();
        return;
    }

    const pos = { x: this.currentPiece.x, y: this.currentPiece.y };
    if (move !== 'rotation' && (pos.x !== oldX || pos.y !== oldY))
      this.isSpin = false;

    this.drawPiece();
  }

  async removeLines() {
    this.inRemoveLines = true;

    const linesToRemoveIdx = this.board.reduce((acc, row, i) => {
      if (row.every((cell) => cell >= 1 && cell <= 7)) acc.push(i);
      return acc;
    }, []);

    if (linesToRemoveIdx.length === 0) return (this.inRemoveLines = false);

    await new Promise((resolve) => setTimeout(resolve, 200));
    this.board = this.board.map((row, i) =>
      linesToRemoveIdx.includes(i) ? Array(COLS).fill(0) : row,
    );
    this.sendUpdate();

    await new Promise((resolve) => setTimeout(resolve, 200));
    this.board = this.board.filter((_, i) => !linesToRemoveIdx.includes(i));
    linesToRemoveIdx.forEach(() => this.board.unshift(Array(COLS).fill(0)));
    this.sendUpdate();
    this.updateSpectrum();

    if (linesToRemoveIdx.length > 1)
      this.addPenaltyLinesToOthers(linesToRemoveIdx.length - 1);

    if (this.isSpin) this.applySpinPenaltyToOthers(linesToRemoveIdx.length);

    this.inRemoveLines = false;
  }

  addPenaltyLines(nbLines) {
    if (nbLines === 0) return;

    this.clearPiece();
    this.board = this.board.slice(nbLines);
    for (let i = 0; i < nbLines; i++) {
      this.board.push(Array(COLS).fill(8));
      if (this.checkCollision() === Collision.BLOCK) this.currentPiece.y--;
    }
    this.updateSpectrum();
    this.drawPiece();
  }

  applySpinPenalty(spinPenalty) {
    this.spinPenalty = spinPenalty;
    this.launchFallInterval();
    this.spinPenaltyTimeout = setTimeout(() => {
      this.spinPenalty = 0;
      this.launchFallInterval();
      clearTimeout(this.spinPenaltyTimeout);
    }, 10000);
  }

  checkCollision() {
    let collision = Collision.NONE;

    this.traversePiece((cellX, cellY) => {
      if (this.board[cellY]?.[cellX] && this.board[cellY][cellX] !== 0)
        collision = Collision.BLOCK;
      else if (cellY >= ROWS) collision = Collision.BOTTOM;
      else if (cellX < 0) collision = Collision.LEFT;
      else if (cellX >= COLS) collision = Collision.RIGHT;
    });

    return collision;
  }

  clearPiece() {
    this.traversePiece((cellX, cellY) => {
      if (this.board[cellY]?.[cellX] !== undefined)
        this.board[cellY][cellX] = 0;
    });
  }

  drawPiece() {
    this.traversePiece((cellX, cellY, cellValue) => {
      if (this.board[cellY]?.[cellX] !== undefined)
        this.board[cellY][cellX] = cellValue;
    });
    this.sendUpdate();
  }

  lockPiece() {
    this.currentPiece.y--;
    clearInterval(this.fallInterval);
    this.drawPiece();
    this.updateSpectrum();
    this.requestPieceAndMakeItFall();
  }

  traversePiece(callback) {
    if (!this.currentPiece) return;

    const { shape, x, y } = this.currentPiece;
    const N = shape.length;

    for (let i = 0; i < N; i++)
      for (let j = 0; j < N; j++) {
        const cellX = x + j;
        const cellY = y + i;
        if (shape[i][j] !== 0) callback(cellX, cellY, shape[i][j]);
      }
  }

  checkTSpin() {
    if (this.currentPiece.type !== 'T') return;
    // prettier-ignore
    const corners = [[0, 0], [0, 2], [2, 0], [2, 2]]
      .map(
        ([x, y]) =>
          this.board[this.currentPiece.y + y]?.[this.currentPiece.x + x],
      );
    const occupiedCorners = corners.filter((cell) => cell !== 0).length;
    if (occupiedCorners >= 3) this.isSpin = true;
  }

  updateSpectrum() {
    for (let i = 0; i < COLS; i++) {
      let y = 0;
      while (y < ROWS && this.board[y][i] === 0) y++;
      this.spectrum[i] = ROWS - y;
    }
    this.spectrumUpdated();
  }

  sendUpdate() {
    this.socket.emit('game:update', {
      board: this.board.flat(),
      gameOver: !this.alive,
    });
  }
}
