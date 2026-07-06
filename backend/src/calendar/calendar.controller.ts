import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser, JwtUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { CalendarService } from './calendar.service';
import { CreateExemptionDto } from './dto/calendar.dto';

@Controller('calendar')
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @Get('exemptions')
  @Roles(Role.LEADER, Role.ADMIN)
  list(
    @CurrentUser() user: JwtUser,
    @Query('teamId') teamId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const tid = teamId ? Number(teamId) : user.role === Role.LEADER ? user.teamId ?? undefined : undefined;
    if (user.role === Role.LEADER) {
      this.calendarService.assertTeamAccess(
        { role: user.role as Role, teamId: user.teamId },
        tid,
      );
    }
    return this.calendarService.list({ teamId: tid, from, to });
  }

  @Post('exemptions')
  @Roles(Role.ADMIN)
  create(@CurrentUser() user: JwtUser, @Body() dto: CreateExemptionDto) {
    return this.calendarService.create(user.id, dto);
  }

  @Delete('exemptions/:id')
  @Roles(Role.ADMIN)
  remove(@CurrentUser() user: JwtUser, @Param('id', ParseIntPipe) id: number) {
    return this.calendarService.remove(user.id, id);
  }
}
