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
import { CreateTeamDto, UpdateTeamDto } from './dto/teams.dto';
import { TeamsService } from './teams.service';

@Controller('teams')
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  // 列表：负责人和管理员都可查看（用于表单选择团队等）
  @Get()
  @Roles(Role.ADMIN, Role.LEADER)
  list() {
    return this.teamsService.list();
  }

  @Get('mine')
  @Roles(Role.USER, Role.LEADER)
  myTeams(@CurrentUser() user: JwtUser) {
    return this.teamsService.listMyTeams(user.id, user.role as Role);
  }

  @Get('managed')
  @Roles(Role.LEADER)
  managedTeams(@CurrentUser() user: JwtUser) {
    return this.teamsService.listManagedTeams(user.id);
  }

  @Post('active')
  @Roles(Role.USER, Role.LEADER)
  setActiveTeam(@CurrentUser() user: JwtUser, @Query('teamId') teamId: string) {
    return this.teamsService.setActiveTeam(user.id, user.role as Role, Number(teamId));
  }

  @Get('members')
  @Roles(Role.ADMIN, Role.LEADER)
  members(
    @CurrentUser() user: JwtUser,
    @Query('teamId') teamId?: string,
    @Query('date') date?: string,
  ) {
    return this.teamsService.membersOverview(
      { id: user.id, role: user.role as Role, teamId: user.teamId },
      teamId ? Number(teamId) : undefined,
      date,
    );
  }

  @Get('peers')
  peers(@CurrentUser() user: JwtUser, @Query('teamId') teamId?: string) {
    return this.teamsService.peers(
      { id: user.id, role: user.role as Role, teamId: user.teamId },
      teamId ? Number(teamId) : undefined,
    );
  }

  @Post('leave')
  @Roles(Role.USER)
  leaveTeam(@CurrentUser() user: JwtUser, @Query('teamId') teamId?: string) {
    return this.teamsService.leaveTeam(user.id, teamId ? Number(teamId) : undefined);
  }

  @Post('members/:userId/remove')
  @Roles(Role.LEADER)
  removeMember(
    @CurrentUser() user: JwtUser,
    @Param('userId', ParseIntPipe) userId: number,
    @Query('teamId') teamId?: string,
  ) {
    return this.teamsService.removeMember(user.id, userId, teamId ? Number(teamId) : undefined);
  }

  @Post()
  @Roles(Role.ADMIN)
  create(@Body() dto: CreateTeamDto) {
    return this.teamsService.create(dto);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateTeamDto) {
    return this.teamsService.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.teamsService.remove(id);
  }
}
