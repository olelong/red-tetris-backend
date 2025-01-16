import {
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Inject } from '@nestjs/common';

import { BaseGateway } from '../utils/gateway-interceptor';
import { GameService } from './game.service';

import ValidateDto from '../utils/validate-dto.decorator';
import { createRoomDto, joinRoomDto, moveDto } from './game.dto';

@WebSocketGateway()
export class GameGateway extends BaseGateway {
  @WebSocketServer() server;

  constructor(@Inject(GameService) gameService) {
    super();
    this.gameService = gameService;
  }
  afterInit() {
    this.gameService.afterInit(this.server);
  }

  handleDisconnect(socket) {
    this.gameService.handleDisconnect(socket);
  }

  @SubscribeMessage('room:create')
  @ValidateDto(createRoomDto)
  onRoomCreate(socket, { room, username }) {
    return this.gameService.createRoom(socket, room, username);
  }

  @SubscribeMessage('room:join')
  @ValidateDto(joinRoomDto)
  onRoomJoin(socket, { room, username }) {
    return this.gameService.joinRoom(socket, room, username);
  }

  @SubscribeMessage('game:launch')
  onGameLaunch(socket) {
    return this.gameService.launchGame(socket);
  }

  @SubscribeMessage('game:move')
  @ValidateDto(moveDto)
  onGameMove(socket, { move }) {
    return this.gameService.makeMove(socket, move);
  }
}
