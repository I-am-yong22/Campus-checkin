import { Body, Controller, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser, JwtUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AttendanceRuleService } from './attendance-rule.service';
import { AttendanceTasksService } from './attendance-tasks.service';
import { CreateAttendanceTaskDto, UpdateAttendanceTaskDto } from './dto/attendance-task.dto';
import { UpdatePlatformRuleDto } from './dto/platform-rule.dto';
import { todayStr } from '../common/datetime';

@Controller('admin/attendance-tasks')
@Roles(Role.ADMIN)
export class AttendanceTasksController {
  constructor(private readonly tasksService: AttendanceTasksService) {}

  @Get()
  list(@Query('month') month?: string) {
    return this.tasksService.list(month);
  }

  @Post()
  create(@CurrentUser() user: JwtUser, @Body() dto: CreateAttendanceTaskDto) {
    return this.tasksService.create(user.id, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateAttendanceTaskDto,
  ) {
    return this.tasksService.update(user.id, Number(id), dto);
  }

  @Post(':id/publish')
  publish(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.tasksService.publish(user.id, Number(id));
  }

  @Post(':id/cancel')
  cancel(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.tasksService.cancel(user.id, Number(id));
  }
}

@Controller('admin/platform-attendance-rule')
@Roles(Role.ADMIN)
export class PlatformAttendanceRuleController {
  constructor(private readonly ruleService: AttendanceRuleService) {}

  @Get()
  get() {
    return this.ruleService.getPlatformRuleOrThrow();
  }

  @Put()
  update(@Body() dto: UpdatePlatformRuleDto) {
    return this.ruleService.updatePlatformRule(dto);
  }
}

@Controller('attendance')
export class AttendanceController {
  constructor(private readonly ruleService: AttendanceRuleService) {}

  @Get('effective-rule')
  async effectiveRule(@Query('date') date?: string) {
    const dateStr = date || todayStr();
    const rule = await this.ruleService.resolvePlatformRule(dateStr);
    return { date: dateStr, rule };
  }
}
