import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser, JwtUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { MakeupCheckInDto } from './dto/checkin.dto';
import { CheckInService } from './checkin.service';

@Controller('checkin')
export class CheckInController {
  constructor(private readonly checkInService: CheckInService) {}

  @Get('today')
  today(@CurrentUser() user: JwtUser) {
    return this.checkInService.today(user.id);
  }

  @Get('mine')
  mine(@CurrentUser() user: JwtUser, @Query('month') month?: string) {
    return this.checkInService.mine(user.id, month);
  }

  @Get('work-hours/summary')
  @Roles(Role.USER, Role.LEADER, Role.ADMIN)
  workHoursSummary(@CurrentUser() user: JwtUser, @Query('month') month?: string) {
    return this.checkInService.workHoursSummary(user.id, month);
  }

  @Get('team')
  @Roles(Role.LEADER, Role.ADMIN)
  team(
    @CurrentUser() user: JwtUser,
    @Query('teamId') teamId?: string,
    @Query('date') date?: string,
  ) {
    return this.checkInService.teamCheckIns(
      { id: user.id, role: user.role as Role, teamId: user.teamId },
      { teamId: teamId ? Number(teamId) : undefined, date },
    );
  }

  @Post('makeup')
  @Roles(Role.LEADER, Role.ADMIN)
  makeup(@CurrentUser() user: JwtUser, @Body() dto: MakeupCheckInDto) {
    return this.checkInService.makeup(
      { id: user.id, role: user.role as Role, teamId: user.teamId },
      dto,
    );
  }
}
