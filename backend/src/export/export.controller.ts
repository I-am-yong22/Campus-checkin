import { Controller, Get, Query, Res, ForbiddenException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Response } from 'express';
import { CurrentUser, JwtUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { ExportService } from './export.service';

@Controller('export')
export class ExportController {
  constructor(private readonly exportService: ExportService) {}

  private sendCsv(res: Response, filename: string, content: string) {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.send(content);
  }

  @Get('team-daily')
  @Roles(Role.LEADER, Role.ADMIN)
  async teamDaily(
    @CurrentUser() user: JwtUser,
    @Query('teamId') teamId: string | undefined,
    @Query('date') date: string | undefined,
    @Res() res: Response,
  ) {
    const { filename, content } = await this.exportService.teamDaily(
      { id: user.id, role: user.role as Role, teamId: user.teamId },
      teamId ? Number(teamId) : undefined,
      date,
    );
    this.sendCsv(res, filename, content);
  }

  @Get('user-monthly')
  @Roles(Role.USER, Role.LEADER, Role.ADMIN)
  async userMonthly(
    @CurrentUser() user: JwtUser,
    @Query('month') month: string | undefined,
    @Query('userId') userId: string | undefined,
    @Res() res: Response,
  ) {
    let targetId = user.id;
    if (userId) {
      if (user.role !== Role.ADMIN && Number(userId) !== user.id) {
        throw new ForbiddenException('只能导出自己的签到记录');
      }
      targetId = Number(userId);
    }
    const { filename, content } = await this.exportService.userMonthly(targetId, month);
    this.sendCsv(res, filename, content);
  }

  @Get('overview')
  @Roles(Role.ADMIN)
  async overview(@Query('days') days: string | undefined, @Res() res: Response) {
    const { filename, content } = await this.exportService.overviewCsv(days ? Number(days) : 7);
    this.sendCsv(res, filename, content);
  }

  @Get('work-hours')
  @Roles(Role.ADMIN)
  async workHours(
    @Query('teamId') teamId: string | undefined,
    @Query('month') month: string | undefined,
    @Res() res: Response,
  ) {
    const { filename, content } = await this.exportService.workHours(
      teamId ? Number(teamId) : undefined,
      month,
    );
    this.sendCsv(res, filename, content);
  }
}
