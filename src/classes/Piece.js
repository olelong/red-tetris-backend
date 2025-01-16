import { COLS } from './Player';

export default class Piece {
  static shapes = {
    I: [
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    J: [
      [2, 0, 0],
      [2, 2, 2],
      [0, 0, 0],
    ],
    L: [
      [0, 0, 3],
      [3, 3, 3],
      [0, 0, 0],
    ],
    O: [
      [4, 4],
      [4, 4],
    ],
    S: [
      [0, 5, 5],
      [5, 5, 0],
      [0, 0, 0],
    ],
    T: [
      [0, 6, 0],
      [6, 6, 6],
      [0, 0, 0],
    ],
    Z: [
      [7, 7, 0],
      [0, 7, 7],
      [0, 0, 0],
    ],
  };
  static types = Object.keys(Piece.shapes);

  constructor(type) {
    if (!Piece.types.includes(type)) throw new Error('Invalid Piece Type');
    this.type = type;
    this.shape = Piece.shapes[type];
    this.rotationState = 0;
    this.x = Math.floor(COLS / 2 - this.shape[0].length / 2);
    this.y = 0;
  }

  rotate(checkCollision) {
    let isSpin = false;
    const saveShape = this.shape;

    const N = this.shape.length;
    const result = Array.from({ length: N }, () => Array(N).fill(0));
    for (let i = 0; i < N; i++)
      for (let j = 0; j < N; j++) result[j][N - i - 1] = this.shape[i][j];
    this.shape = result;
    this.rotationState = (this.rotationState + 1) % 4;

    if (checkCollision()) {
      isSpin = this.#kickIt(checkCollision);
      if (!isSpin) {
        this.shape = saveShape;
        this.rotationState = (this.rotationState + 3) % 4;
      }
    }
    return isSpin;
  }

  // prettier-ignore
  static wallKickData = {
    ...Object.fromEntries(
      Piece.types.map((type) => [
        type,
        [
          [[-1, 0], [-1,  1], [0, -2], [-1, -2]], // 270° -> 0° (3 -> 0)
          [[-1, 0], [-1, -1], [0,  2], [-1,  2]], // 0° -> 90° (0 -> 1)
          [[ 1, 0], [ 1,  1], [0, -2], [ 1, -2]], // 90° -> 180° (1 -> 2)
          [[ 1, 0], [ 1, -1], [0,  2], [ 1,  2]], // 180° -> 270° (2 -> 3)
        ],
      ]),
    ),
    'I': [
      [[ 1, 0], [-2, 0], [ 1,  2], [-2, -1]], // 270° -> 0° (3 -> 0)
      [[-2, 0], [ 1, 0], [-2,  1], [ 1, -2]], // 0° -> 90° (0 -> 1)
      [[-1, 0], [ 2, 0], [-1, -2], [ 2,  1]], // 90° -> 180° (1 -> 2)
      [[ 2, 0], [-1, 0], [ 2, -1], [-1,  2]], // 180° -> 270° (2 -> 3)
    ],
  };
  #kickIt(checkCollision) {
    if (this.type === 'O') return false;

    const originalPosition = { x: this.x, y: this.y };
    const tests = Piece.wallKickData[this.type][this.rotationState];
    for (const test of tests) {
      this.x += test[0];
      this.y += test[1];
      if (!checkCollision()) return true;
      this.x = originalPosition.x;
      this.y = originalPosition.y;
    }
    return false;
  }

  clone() {
    return new Piece(this.type);
  }
}
