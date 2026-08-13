import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { EventsGateway } from './events.gateway';

@Module({
  imports: [
    // JwtModule without secret — gateway reads the public key itself from ConfigService
    JwtModule.register({}),
  ],
  providers: [EventsGateway],
  exports: [EventsGateway],
})
export class EventsModule {}
