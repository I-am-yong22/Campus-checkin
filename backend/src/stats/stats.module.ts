import { Module } from '@nestjs/common';
import { TeamsModule } from '../teams/teams.module';
import { StatsController } from './stats.controller';
import { StatsService } from './stats.service';

@Module({
  imports: [TeamsModule],
  controllers: [StatsController],
  providers: [StatsService],
})
export class StatsModule {}
