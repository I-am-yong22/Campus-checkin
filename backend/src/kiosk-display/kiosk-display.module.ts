import { Module } from '@nestjs/common';
import { KioskDisplayController } from './kiosk-display.controller';
import { KioskDisplayService } from './kiosk-display.service';

@Module({
  controllers: [KioskDisplayController],
  providers: [KioskDisplayService],
})
export class KioskDisplayModule {}
