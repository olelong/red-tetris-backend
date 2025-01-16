import { Injectable, Logger } from '@nestjs/common';
import Room from '../classes/Room';
import Player from '../classes/Player';

const SOLO_TAG = '[Solo]';

@Injectable()
export class GameService {
  constructor() {
    this.logger = new Logger('GameService');
  }

  afterInit(server) {
    this.server = server;
    this.rooms = [];
    this.players = [];
    this.logger.log('Game Service Initialized');
  }

  handleDisconnect(socket) {
    this.logger.log(`Client Disconnected: ${socket.id}`);

    const player = this.players.find((player) => player.socket === socket);
    if (!player) return;

    this.players = this.players.filter((p) => p !== player);
    this.logger.log(`Player Removed: ${player.name}`);

    const room = player.room;
    if (!room) return;

    room.removePlayer(player);
    if (room.players.length === 0) {
      this.rooms = this.rooms.filter((r) => r !== room);
      this.logger.log(`Room Removed: ${room.name}`);
    } else room.checkEndOfGame();
  }

  createRoom(socket, roomName, username) {
    const roomNotCreated = (reason) => {
      this.logger.warn(`Room Not Created: ${roomName ?? SOLO_TAG}, ${reason}`);
      return false;
    };

    if (roomName && this.rooms.find((room) => room.name === roomName))
      return roomNotCreated('Room Name Taken');

    const player = this.players.find((player) => player.socket === socket);
    // Should never happen
    if (player && player.room)
      return roomNotCreated('Player already in a Room');

    const newRoom = new Room(this.server, roomName ?? SOLO_TAG);
    const newPlayer = player ?? new Player(socket, username ?? SOLO_TAG);

    newRoom.addPlayer(newPlayer);
    this.rooms.push(newRoom);
    this.players.push(newPlayer);
    return true;
  }

  joinRoom(socket, roomName, username) {
    const roomNotJoined = (reason) => {
      this.logger.warn(`Room Not Joined: ${roomName}, ${reason}`);
      return { joined: false, reason };
    };

    const room = this.rooms.find((room) => room.name === roomName);
    if (!room) return roomNotJoined('Room Not Found');

    const player = this.players.find((player) => player.socket === socket);
    if (player && player.room) return roomNotJoined('Already in a Room');

    const existingPlayer = room.players.find(
      (player) => player.name === username,
    );
    if (existingPlayer) return roomNotJoined('Username Taken');

    if (room.inGame) return roomNotJoined('In Game');

    if (room.players.length >= Room.MAX_PLAYERS)
      return roomNotJoined('Room Full');

    const newPlayer = player ?? new Player(socket, username);

    room.addPlayer(newPlayer);
    this.players.push(newPlayer);
    return { joined: true };
  }

  launchGame(socket) {
    const player = this.players.find((player) => player.socket === socket);
    if (!player) return false;

    const room = player.room;
    if (!room) return false;

    if (room.master !== player) return false;

    return room.launchGame();
  }

  makeMove(socket, move) {
    const player = this.players.find((player) => player.socket === socket);
    if (!player) return false;

    const room = player.room;
    if (!room) return false;

    return room.makeMove(player, move);
  }
}
