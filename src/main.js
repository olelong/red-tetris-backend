import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

import { IoAdapter } from '@nestjs/platform-socket.io';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useWebSocketAdapter(new SocketIOAdapter(app));
  await app.listen(process.env.PORT || 3000);
}
bootstrap();

class SocketIOAdapter extends IoAdapter {
  createIOServer(port, options) {
    const optionsWithCORS = {
      ...options,
      cors: {
        origin: true,
        allowedHeaders: 'Authorization, Content-Type, Accept',
        methods: 'GET',
      },
    };
    const server = super.createIOServer(port, optionsWithCORS);
    return server;
  }
}
