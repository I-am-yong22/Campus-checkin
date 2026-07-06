import { Module } from '@nestjs/common';
import { TeamsModule } from '../teams/teams.module';
import { TeamWorkflowController } from './team-workflow.controller';
import { TeamWorkflowService } from './team-workflow.service';

@Module({
  imports: [TeamsModule],
  controllers: [TeamWorkflowController],
  providers: [TeamWorkflowService],
  exports: [TeamWorkflowService],
})
export class TeamWorkflowModule {}
