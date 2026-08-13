import { Module } from '@nestjs/common';
import { DeliveryController } from './delivery.controller';
import { DeliveryService } from './delivery.service';
import { ShiprocketService } from './shiprocket.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [DeliveryController],
  providers: [DeliveryService, ShiprocketService],
  exports: [DeliveryService],
})
export class DeliveryModule {}
