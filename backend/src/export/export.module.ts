import { Module } from '@nestjs/common';
import { TeamsModule } from '../teams/teams.module';
import { ExportController } from './export.controller';
import { ExportService } from './export.service';

@Module({
  imports: [TeamsModule],
  controllers: [ExportController],
  providers: [ExportService],
})
export class ExportModule {}
