import {
  Injectable,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { catchError, EMPTY } from 'rxjs';

@Injectable()
export class ErrorHandlingInterceptor {
  intercept(context, next) {
    return next.handle().pipe(
      catchError((err) => {
        this.catch(err, context);
        return EMPTY;
      }),
    );
  }

  catch(exception, context) {
    console.error(exception);
    const ws = context.switchToWs();
    const client = ws.getClient();
    const data = ws.getData();
    const event = Reflect.getMetadata('message', context.getHandler());
    const error = {
      errorMsg: 'Internal Server Error',
      origin: { event, data },
    };
    client.emit('error', error);
  }
}

@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
@UseInterceptors(ErrorHandlingInterceptor)
export class BaseGateway {}
