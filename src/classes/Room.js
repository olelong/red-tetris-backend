import { Logger } from '@nestjs/common';
import Piece from './Piece';

export default class Room {
  static MAX_PLAYERS = 13;

  constructor(server, name) {
    this.server = server;
    this.name = name;
    this.players = [];
    this.inGame = false;
    this.master = null;

    this.logger = new Logger(`Room ${name}`);
    this.logger.log(`Room Created`);
  }

  addPlayer(player) {
    if (this.players.length >= Room.MAX_PLAYERS) return false;

    this.players.push(player);
    player.room = this;
    player.socket.join(this.name);
    this.logger.log(`Player ${player.name} joined`);

    if (this.players.length === 1) this.setMaster(player);
    else player.socket.emit('room:master', { username: this.master?.name });

    this.emitAll('room:players', {
      players: this.players.map((p) => p.name),
    });
  }

  removePlayer(player) {
    this.players = this.players.filter((p) => p !== player);
    player.room = null;
    player.socket.leave(this.name);
    player.alive = false;
    this.logger.log(`Player ${player.name} left`);

    if (this.master === player) this.setMaster(this.players[0] ?? null);

    this.emitAll('room:players', {
      players: this.players.map((p) => p.name),
    });
  }

  setMaster(player) {
    if (this.master) this.master.isMaster = false;
    this.master = player;
    if (player) player.isMaster = true;

    this.emitAll('room:master', { username: player?.name });
    if (player) this.logger.log(`Master is now ${player.name}`);
  }

  makeMove(player, move) {
    if (!this.players.includes(player)) return false;
    player.makeMove(move);
    return this.inGame;
  }

  static NB_PIECES_GROUPS = 15;
  static RAND_PIECES_COUNT = Piece.types.length * Room.NB_PIECES_GROUPS;
  launchGame() {
    if (this.inGame) return false;
    this.inGame = true;

    this.solo = this.players.length === 1;
    this.pieces = this.generatePieces();
    this.playersPieces = Object.fromEntries(
      this.players.map((p) => [p.name, 0]),
    );
    this.players.forEach((player) => {
      player.requestPiece = () => this.requestPiece(player);
      player.addPenaltyLinesToOthers = (nbLines) =>
        this.addPenaltyLinesToOthers(player, nbLines);
      player.applySpinPenaltyToOthers = (spinPenalty) =>
        this.applySpinPenaltyToOthers(player, spinPenalty);
      player.spectrumUpdated = () => this.spectrumUpdated();
      player.checkEndOfGame = () => this.checkEndOfGame();
      player.initGame();
    });

    this.logger.log(`Game Launched`);
    return true;
  }

  generatePieces() {
    const shuffleArray = (array) => {
      const newArray = [...array];
      for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
      }
      return newArray;
    };
    let pieces = [];
    for (let i = 0; i < Room.NB_PIECES_GROUPS; i++)
      pieces = pieces.concat(shuffleArray(Piece.types));
    return pieces.map((type) => new Piece(type));
  }

  requestPiece(player) {
    if (!this.players.includes(player)) return null;
    const piece = this.pieces[this.playersPieces[player.name]].clone();
    this.playersPieces[player.name] =
      (this.playersPieces[player.name] + 1) % Room.RAND_PIECES_COUNT;
    return piece;
  }

  addPenaltyLinesToOthers(player, nbLines) {
    this.players
      .filter((p) => p !== player)
      .forEach((p) => p.addPenaltyLines(nbLines));
  }

  applySpinPenaltyToOthers(player, spinPenalty) {
    this.players
      .filter((p) => p !== player)
      .forEach((p) => p.applySpinPenalty(spinPenalty));
  }

  spectrumUpdated() {
    this.emitAll('game:spectrums', {
      spectrums: this.players.map((player) => ({
        username: player.name,
        spectrum: player.spectrum,
      })),
    });
  }

  checkEndOfGame() {
    const alivePlayers = this.players.filter((player) => player.alive);
    if (alivePlayers.length > 1) return;
    if (!this.solo || alivePlayers.length === 0) {
      this.inGame = false;
      this.emitAll(
        'game:end',
        this.solo ? {} : { winner: alivePlayers[0]?.name },
      );
      this.logger.log(`Game Ended`);
    }
  }

  emitAll(event, data) {
    this.server.to(this.name).emit(event, data);
  }
}
