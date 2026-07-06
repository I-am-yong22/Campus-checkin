import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser, JwtUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateLeaveDto, ReviewLeaveDto } from './dto/leave.dto';
import { LeaveService } from './leave.service';

@Controller('leave')
export class LeaveController {
  constructor(private readonly leaveService: LeaveService) {}

  @Post()
  @Roles(Role.USER, Role.LEADER)
  create(@CurrentUser() user: JwtUser, @Body() dto: CreateLeaveDto) {
    return this.leaveService.create(user.id, user.role as Role, dto);
  }

  @Get('mine')
  @Roles(Role.USER, Role.LEADER)
  mine(@CurrentUser() user: JwtUser) {
    return this.leaveService.mine(user.id);
  }

  @Get('pending')
  @Roles(Role.LEADER, Role.ADMIN)
  pending(@CurrentUser() user: JwtUser) {
    return this.leaveService.pendingForReview({
      id: user.id,
      role: user.role as Role,
      teamId: user.teamId,
    });
  }

  @Get('pending/count')
  @Roles(Role.LEADER, Role.ADMIN)
  pendingCount(@CurrentUser() user: JwtUser) {
    return this.leaveService.pendingCount({
      id: user.id,
      role: user.role as Role,
      teamId: user.teamId,
    });
  }

  @Get('reviewed')
  @Roles(Role.LEADER, Role.ADMIN)
  reviewed(@CurrentUser() user: JwtUser) {
    return this.leaveService.reviewHistory({
      id: user.id,
      role: user.role as Role,
      teamId: user.teamId,
    });
  }

  @Patch(':id/review')
  @Roles(Role.LEADER, Role.ADMIN)
  review(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReviewLeaveDto,
  ) {
    return this.leaveService.review(
      { id: user.id, role: user.role as Role, teamId: user.teamId },
      id,
      dto,
    );
  }

  @Delete(':id')
  @Roles(Role.USER, Role.LEADER)
  cancel(@CurrentUser() user: JwtUser, @Param('id', ParseIntPipe) id: number) {
    return this.leaveService.cancel(user.id, id);
  }
}
