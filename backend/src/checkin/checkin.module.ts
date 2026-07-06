import { Module } from '@nestjs/common';
import { AttendanceModule } from '../attendance/attendance.module';
import { TeamsModule } from '../teams/teams.module';
import { CheckInController } from './checkin.controller';
import { CheckInService } from './checkin.service';

@Module({
  imports: [TeamsModule, AttendanceModule],
  controllers: [CheckInController],
  providers: [CheckInService],
  exports: [CheckInService],
})
export class CheckInModule {}
