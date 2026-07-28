import { Global, Module } from '@nestjs/common';
import { NotificationDispatcher } from './notification-dispatcher';

@Global()
@Module({
  providers: [NotificationDispatcher],
  exports: [NotificationDispatcher],
})
export class EventsModule {}
