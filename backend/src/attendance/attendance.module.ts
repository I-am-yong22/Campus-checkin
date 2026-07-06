import { Module } from '@nestjs/common';
import {
  AttendanceController,
  AttendanceTasksController,
  PlatformAttendanceRuleController,
} from './attendance.controller';
import { AttendanceRuleService } from './attendance-rule.service';
import { AttendanceTasksService } from './attendance-tasks.service';
import { AutoCheckoutCron } from './auto-checkout.cron';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [AttendanceTasksController, PlatformAttendanceRuleController, AttendanceController],
  providers: [AttendanceRuleService, AttendanceTasksService, AutoCheckoutCron],
  exports: [AttendanceRuleService],
})
export class AttendanceModule {}
