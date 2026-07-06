import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import {
  SaveBirthdayDto,
  SaveCarouselSlideDto,
  SaveCountdownDto,
  SaveMissionBoardDto,
} from './dto/kiosk-display.dto';
import { KioskDisplayService } from './kiosk-display.service';

@Controller('kiosk-display')
export class KioskDisplayController {
  constructor(private readonly service: KioskDisplayService) {}

  @Get('standby')
  @Public()
  standby() {
    return this.service.standbyPayload();
  }

  @Get('carousel')
  @Roles(Role.ADMIN)
  listCarousel() {
    return this.service.listCarousel();
  }

  @Post('carousel')
  @Roles(Role.ADMIN)
  saveCarousel(@Body() dto: SaveCarouselSlideDto) {
    return this.service.saveCarousel(dto);
  }

  @Delete('carousel/:id')
  @Roles(Role.ADMIN)
  deleteCarousel(@Param('id') id: string) {
    return this.service.deleteCarousel(Number(id));
  }

  @Get('countdowns')
  @Roles(Role.ADMIN)
  listCountdowns() {
    return this.service.listCountdowns();
  }

  @Post('countdowns')
  @Roles(Role.ADMIN)
  saveCountdown(@Body() dto: SaveCountdownDto) {
    return this.service.saveCountdown(dto);
  }

  @Delete('countdowns/:id')
  @Roles(Role.ADMIN)
  deleteCountdown(@Param('id') id: string) {
    return this.service.deleteCountdown(Number(id));
  }

  @Get('mission-boards')
  @Roles(Role.ADMIN)
  listMissionBoards() {
    return this.service.listMissionBoards();
  }

  @Post('mission-boards')
  @Roles(Role.ADMIN)
  saveMissionBoard(@Body() dto: SaveMissionBoardDto) {
    return this.service.saveMissionBoard(dto);
  }

  @Delete('mission-boards/:id')
  @Roles(Role.ADMIN)
  deleteMissionBoard(@Param('id') id: string) {
    return this.service.deleteMissionBoard(Number(id));
  }

  @Get('birthdays')
  @Roles(Role.ADMIN)
  listBirthdays(@Query('month') month?: string) {
    return this.service.listBirthdays(month);
  }

  @Post('birthdays')
  @Roles(Role.ADMIN)
  saveBirthday(@Body() dto: SaveBirthdayDto) {
    return this.service.saveBirthday(dto);
  }

  @Delete('birthdays/:id')
  @Roles(Role.ADMIN)
  deleteBirthday(@Param('id') id: string) {
    return this.service.deleteBirthday(Number(id));
  }
}
