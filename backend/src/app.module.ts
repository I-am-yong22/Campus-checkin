import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { CalendarModule } from './calendar/calendar.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { CheckInModule } from './checkin/checkin.module';
import { ExportModule } from './export/export.module';
import { FaceModule } from './face/face.module';
import { LeaveModule } from './leave/leave.module';
import { PrismaModule } from './prisma/prisma.module';
import { StatsModule } from './stats/stats.module';
import { TeamsModule } from './teams/teams.module';
import { TeamWorkflowModule } from './team-workflow/team-workflow.module';
import { UsersModule } from './users/users.module';
import { AttendanceModule } from './attendance/attendance.module';
import { KioskDisplayModule } from './kiosk-display/kiosk-display.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuditModule,
    AuthModule,
    UsersModule,
    TeamsModule,
    FaceModule,
    CheckInModule,
    LeaveModule,
    StatsModule,
    CalendarModule,
    ExportModule,
    TeamWorkflowModule,
    AttendanceModule,
    KioskDisplayModule,
  ],
  controllers: [AppController],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
