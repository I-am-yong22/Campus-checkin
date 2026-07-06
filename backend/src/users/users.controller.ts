import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser, JwtUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateUserDto, ImportUsersDto, ResetPasswordDto, UpdateUserDto } from './dto/users.dto';
import { UsersService } from './users.service';

@Controller('admin/users')
@Roles(Role.ADMIN)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  list(
    @Query('role') role?: Role,
    @Query('teamId') teamId?: string,
    @Query('keyword') keyword?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.usersService.list({
      role,
      teamId: teamId ? Number(teamId) : undefined,
      keyword,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Post('import')
  importMany(@Body() dto: ImportUsersDto) {
    return this.usersService.importMany(dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.update(user.id, id, dto);
  }

  @Post(':id/reset-password')
  resetPassword(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ResetPasswordDto,
  ) {
    return this.usersService.resetPassword(user.id, id, dto.password);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.remove(id);
  }
}
