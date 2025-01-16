import { Test } from '@nestjs/testing';
import { GameGateway } from './game.gateway';
import { GameService } from './game.service';
import Room from '../classes/Room';
import Piece from '../classes/Piece';
import { ROWS } from '../classes/Player';
import { ErrorHandlingInterceptor } from '../utils/gateway-interceptor';
import { throwError } from 'rxjs';

function createSocket() {
  return {
    join: jest.fn(),
    leave: jest.fn(),
    emit: jest.fn(),
  };
}

describe('GameGateway', () => {
  let gateway;
  let service;
  const socket = createSocket();

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [GameService, GameGateway],
    }).compile();

    gateway = module.get(GameGateway);
    service = module.get(GameService);

    gateway.server = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    };

    service.afterInit(gateway.server);
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
    expect(service).toBeDefined();
    expect(service.rooms).toStrictEqual([]);
  });

  it('should create a room', async () => {
    const result = await gateway.onRoomCreate(socket, {
      room: '42Paris',
      username: 'whazami',
    });

    expect(result).toBe(true);
  });

  it('should create a solo room', async () => {
    const result = await gateway.onRoomCreate(socket, {});

    expect(result).toBe(true);
  });

  it('should not create a room if room name is taken', async () => {
    await gateway.onRoomCreate(socket, {
      room: '42Paris',
      username: 'whazami',
    });

    const result = await gateway.onRoomCreate(socket, {
      room: '42Paris',
      username: 'olelong',
    });

    expect(result).toBe(false);
  });

  it('should join a room', async () => {
    await gateway.onRoomCreate(socket, {
      room: '42Paris',
      username: 'whazami',
    });

    const socket2 = createSocket();
    const result = await gateway.onRoomJoin(socket2, {
      room: '42Paris',
      username: 'olelong',
    });

    expect(result.joined).toBe(true);
  });

  it("should not join a room if it's full", async () => {
    await gateway.onRoomCreate(socket, {
      room: '42Paris',
      username: 'whazami',
    });

    let result = false;

    for (let i = 0; i < Room.MAX_PLAYERS; i++) {
      result = await gateway.onRoomJoin(createSocket(), {
        room: '42Paris',
        username: `player${i}`,
      });
    }

    expect(result.joined).toBe(false);
  });

  it("should change master when needed and remove a room if it's empty", async () => {
    await gateway.onRoomCreate(socket, {
      room: '42Paris',
      username: 'whazami',
    });

    const socket2 = createSocket();
    await gateway.onRoomJoin(socket2, {
      room: '42Paris',
      username: 'olelong',
    });

    gateway.handleDisconnect(socket);

    const room = service.rooms[0];
    expect(room.master.name).toBe('olelong');

    gateway.handleDisconnect(socket2);

    expect(service.rooms).toStrictEqual([]);
  });

  it('should launch a game', async () => {
    await gateway.onRoomCreate(socket, {
      room: '42Paris',
      username: 'whazami',
    });

    const result = await gateway.onGameLaunch(socket);

    expect(result).toBe(true);

    // Close the room
    gateway.handleDisconnect(socket);
  });

  it('should catch internal errors', (done) => {
    const interceptor = new ErrorHandlingInterceptor();
    const context = {
      switchToWs: jest.fn().mockReturnValue({
        getClient: jest.fn().mockReturnValue(socket),
        getData: jest.fn().mockReturnValue({ room: '42Paris' }),
      }),
      getHandler: jest.fn().mockReturnValue({}),
    };
    const next = {
      handle: jest
        .fn()
        .mockReturnValue(
          throwError(() => new Error('Simulated Internal Server Error')),
        ),
    };

    const consoleError = console.error;
    console.error = () => {};
    interceptor.intercept(context, next).subscribe({
      complete: () => {
        expect(socket.emit).toHaveBeenCalledWith('error', {
          errorMsg: 'Internal Server Error',
          origin: { event: undefined, data: { room: '42Paris' } },
        });
        done();
      },
    });
    console.error = consoleError;
  });

  it('should move pieces', async () => {
    await gateway.onRoomCreate(socket, {
      room: '42Paris',
      username: 'whazami',
    });

    await gateway.onGameLaunch(socket);

    await new Promise((resolve) => setTimeout(resolve, 2000));

    const room = service.rooms[0];
    const piece = room.players[0].currentPiece;
    const x = piece.x;

    await gateway.onGameMove(socket, { move: 'left' });

    expect(piece.x).toBe(x - 1);

    // Close the room
    gateway.handleDisconnect(socket);
  });

  it('should give the same pieces to all players', async () => {
    await gateway.onRoomCreate(socket, {
      room: '42Paris',
      username: 'whazami',
    });

    const socket2 = createSocket();
    await gateway.onRoomJoin(socket2, {
      room: '42Paris',
      username: 'olelong',
    });

    await gateway.onGameLaunch(socket);

    await new Promise((resolve) => setTimeout(resolve, 2000));

    const room = service.rooms[0];
    const piece = room.players[0].currentPiece;
    const piece2 = room.players[1].currentPiece;

    expect(piece).toStrictEqual(piece2);

    // Close the room
    gateway.handleDisconnect(socket);
    gateway.handleDisconnect(socket2);
  });

  it('should rotate piece properly', () => {
    const piece = new Piece('S');
    piece.rotate(() => false);
    expect(piece.shape).toStrictEqual([
      [0, 5, 0],
      [0, 5, 5],
      [0, 0, 5],
    ]);
  });

  it('should remove lines and send penalty lines', async () => {
    await gateway.onRoomCreate(socket, {
      room: '42Paris',
      username: 'whazami',
    });

    const socket2 = createSocket();
    await gateway.onRoomJoin(socket2, {
      room: '42Paris',
      username: 'olelong',
    });

    await gateway.onGameLaunch(socket);

    const room = service.rooms[0];
    room.pieces = ['I', 'I', 'I', 'I', 'O', 'T'].map((type) => new Piece(type));

    await new Promise((resolve) => setTimeout(resolve, 2000));

    for (let i = 0; i < 5; i++) {
      for (let j = 0; j < (i < 2 || i === 4 ? 4 : 1); j++)
        await gateway.onGameMove(socket, { move: i < 2 ? 'left' : 'right' });
      await gateway.onGameMove(socket, { move: 'hard drop' });
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const checkEmptyLines = (board) => {
      for (let i = ROWS - 1; i >= ROWS - 2; i--)
        if (board[i].some((cell) => cell !== 0)) return false;
      return true;
    };
    const player = room.players[0];
    expect(checkEmptyLines(player.board)).toBe(true);

    const checkPenaltyLine = (board) => {
      return board[ROWS - 1].every((cell) => cell === 8);
    };
    const player2 = room.players[1];
    expect(checkPenaltyLine(player2.board)).toBe(true);

    // Close the room
    gateway.handleDisconnect(socket);
    gateway.handleDisconnect(socket2);
  });

  it('should perform a T-spin Triple and send gravity penalty', async () => {
    await gateway.onRoomCreate(socket, {
      room: '42Paris',
      username: 'whazami',
    });

    const socket2 = createSocket();
    await gateway.onRoomJoin(socket2, {
      room: '42Paris',
      username: 'olelong',
    });

    await gateway.onGameLaunch(socket);

    const room = service.rooms[0];
    room.pieces = ['T', 'T', 'T'].map((type) => new Piece(type));

    await new Promise((resolve) => setTimeout(resolve, 2000));

    const player = room.players[0];
    const lowerBoard = [
      [1, 1, 0, 0, 0, 0, 0, 0, 0, 0],
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [1, 0, 1, 1, 1, 1, 1, 1, 1, 1],
      [1, 0, 0, 1, 1, 1, 1, 1, 1, 1],
      [1, 0, 1, 1, 1, 1, 1, 1, 1, 1],
    ];
    player.board = player.board.map((row, i) =>
      i >= ROWS - lowerBoard.length
        ? lowerBoard[i - ROWS + lowerBoard.length]
        : row,
    );

    for (let i = 0; i < ROWS; i++)
      await gateway.onGameMove(socket, { move: 'soft drop' });
    for (let i = 0; i < 2; i++)
      await gateway.onGameMove(socket, { move: 'left' });
    await gateway.onGameMove(socket, { move: 'rotation' });

    await new Promise((resolve) => setTimeout(resolve, 2000));

    const checkEmptyLines = (board) => {
      const lowerEmptyBoard = [
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [1, 1, 0, 0, 0, 0, 0, 0, 0, 0],
        [1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      ];
      for (let i = ROWS - 1; i >= ROWS - lowerEmptyBoard.length; i--)
        if (
          board[i].some(
            (cell, j) =>
              cell !== lowerEmptyBoard[i - ROWS + lowerEmptyBoard.length][j],
          )
        )
          return false;
      return true;
    };
    expect(checkEmptyLines(player.board)).toBe(true);

    const player2 = room.players[1];
    expect(player2.spinPenalty).toBe(3);
    clearTimeout(player2.spinPenaltyTimeout);

    // Close the room
    gateway.handleDisconnect(socket);
    gateway.handleDisconnect(socket2);
  });
});
