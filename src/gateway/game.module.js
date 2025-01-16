import { GameService } from './game.service';
import { GameGateway } from './game.gateway';
import { Module } from '@nestjs/common';

@Module({ providers: [GameGateway, GameService] })
export class GameModule {}
