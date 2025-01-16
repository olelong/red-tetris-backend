import { Module } from '@nestjs/common';
import { GameModule } from './gateway/game.module';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';

@Module({
  imports: [
    GameModule,
    ServeStaticModule.forRoot({ rootPath: join(__dirname, '..', 'frontend') }),
  ],
})
export class AppModule {}
