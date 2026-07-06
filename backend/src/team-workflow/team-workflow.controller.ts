import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser, JwtUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import {
  CreateTeamApplicationDto,
  CreateTeamInvitationDto,
  JoinTeamByCodeDto,
  ReviewTeamApplicationDto,
} from './dto/team-workflow.dto';
import { TeamWorkflowService } from './team-workflow.service';

@Controller()
export class TeamWorkflowController {
  constructor(private readonly workflow: TeamWorkflowService) {}

  // ── 团队创建申请 ──

  @Post('team-applications')
  @Roles(Role.LEADER)
  createApplication(@CurrentUser() user: JwtUser, @Body() dto: CreateTeamApplicationDto) {
    return this.workflow.createApplication(user.id, dto);
  }

  @Get('team-applications/mine')
  @Roles(Role.LEADER)
  myApplications(@CurrentUser() user: JwtUser) {
    return this.workflow.myApplications(user.id);
  }

  @Get('team-applications/pending')
  @Roles(Role.ADMIN)
  pendingApplications() {
    return this.workflow.pendingApplications();
  }

  @Get('team-applications/pending/count')
  @Roles(Role.ADMIN)
  pendingApplicationCount() {
    return this.workflow.pendingApplicationCount();
  }

  @Patch('team-applications/:id/review')
  @Roles(Role.ADMIN)
  reviewApplication(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReviewTeamApplicationDto,
  ) {
    return this.workflow.reviewApplication(user.id, id, dto);
  }

  // ── 成员邀请 ──

  @Get('team-invitations/candidates')
  @Roles(Role.LEADER)
  candidates(
    @CurrentUser() user: JwtUser,
    @Query('keyword') keyword?: string,
    @Query('teamId') teamId?: string,
  ) {
    return this.workflow.inviteCandidates(user.id, keyword, teamId ? Number(teamId) : undefined);
  }

  @Post('team-invitations')
  @Roles(Role.LEADER)
  createInvitation(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateTeamInvitationDto,
    @Query('teamId') teamId?: string,
  ) {
    return this.workflow.createInvitation(user.id, dto, teamId ? Number(teamId) : undefined);
  }

  @Get('team-invitations/sent')
  @Roles(Role.LEADER)
  sentInvitations(@CurrentUser() user: JwtUser, @Query('teamId') teamId?: string) {
    return this.workflow.sentInvitations(user.id, teamId ? Number(teamId) : undefined);
  }

  @Get('team-invitations/mine')
  @Roles(Role.USER)
  myInvitations(@CurrentUser() user: JwtUser) {
    return this.workflow.myInvitations(user.id);
  }

  @Get('team-invitations/pending/count')
  @Roles(Role.USER)
  pendingInvitationCount(@CurrentUser() user: JwtUser) {
    return this.workflow.pendingInvitationCount(user.id);
  }

  @Patch('team-invitations/:id/accept')
  @Roles(Role.USER)
  acceptInvitation(@CurrentUser() user: JwtUser, @Param('id', ParseIntPipe) id: number) {
    return this.workflow.acceptInvitation(user.id, id);
  }

  @Patch('team-invitations/:id/reject')
  @Roles(Role.USER)
  rejectInvitation(@CurrentUser() user: JwtUser, @Param('id', ParseIntPipe) id: number) {
    return this.workflow.rejectInvitation(user.id, id);
  }

  @Delete('team-invitations/:id')
  @Roles(Role.LEADER)
  cancelInvitation(@CurrentUser() user: JwtUser, @Param('id', ParseIntPipe) id: number) {
    return this.workflow.cancelInvitation(user.id, id);
  }

  // ── 团队邀请码 ──

  @Get('team-invite-codes/mine')
  @Roles(Role.LEADER)
  myInviteCode(@CurrentUser() user: JwtUser, @Query('teamId') teamId?: string) {
    return this.workflow.myInviteCode(user.id, teamId ? Number(teamId) : undefined);
  }

  @Post('team-invite-codes')
  @Roles(Role.LEADER)
  createInviteCode(@CurrentUser() user: JwtUser, @Query('teamId') teamId?: string) {
    return this.workflow.createInviteCode(user.id, teamId ? Number(teamId) : undefined);
  }

  @Post('team-invite-codes/regenerate')
  @Roles(Role.LEADER)
  regenerateInviteCode(@CurrentUser() user: JwtUser, @Query('teamId') teamId?: string) {
    return this.workflow.regenerateInviteCode(user.id, teamId ? Number(teamId) : undefined);
  }

  @Post('team-invite-codes/disable')
  @Roles(Role.LEADER)
  disableInviteCode(@CurrentUser() user: JwtUser, @Query('teamId') teamId?: string) {
    return this.workflow.disableInviteCode(user.id, teamId ? Number(teamId) : undefined);
  }

  @Get('team-invite-codes/preview')
  @Roles(Role.USER)
  previewInviteCode(@Query('code') code: string) {
    return this.workflow.previewInviteCode(code);
  }

  @Post('team-invite-codes/join')
  @Roles(Role.USER)
  joinByInviteCode(@CurrentUser() user: JwtUser, @Body() dto: JoinTeamByCodeDto) {
    return this.workflow.joinByInviteCode(user.id, dto);
  }
}
