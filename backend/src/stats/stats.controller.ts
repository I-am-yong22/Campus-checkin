import { Controller, Get, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser, JwtUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { StatsService } from './stats.service';

@Controller('stats')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get('overview')
  @Roles(Role.ADMIN)
  overview(@Query('days') days?: string) {
    return this.statsService.overview(days ? Number(days) : 7);
  }

  @Get('team')
  @Roles(Role.LEADER, Role.ADMIN)
  team(
    @CurrentUser() user: JwtUser,
    @Query('teamId') teamId?: string,
    @Query('days') days?: string,
  ) {
    return this.statsService.teamStats(
      { id: user.id, role: user.role as Role, teamId: user.teamId },
      teamId ? Number(teamId) : undefined,
      days ? Number(days) : 7,
    );
  }

  @Get('attention')
  @Roles(Role.LEADER, Role.ADMIN)
  attention(@CurrentUser() user: JwtUser, @Query('teamId') teamId?: string) {
    return this.statsService.attention(
      { id: user.id, role: user.role as Role, teamId: user.teamId },
      teamId ? Number(teamId) : undefined,
    );
  }

  @Get('kiosk')
  @Roles(Role.ADMIN)
  kiosk() {
    return this.statsService.kioskStatus();
  }

  @Get('work-hours/leaderboard')
  @Roles(Role.ADMIN)
  workHoursLeaderboard(
    @Query('month') month?: string,
    @Query('teamId') teamId?: string,
  ) {
    return this.statsService.workHoursLeaderboard(
      month,
      teamId ? Number(teamId) : undefined,
    );
  }
}
