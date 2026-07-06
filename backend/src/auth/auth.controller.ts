import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { AuthService } from './auth.service';
import { CurrentUser, JwtUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { ChangePasswordDto, LoginDto } from './dto/auth.dto';
import { UpdateProfileDto } from './dto/profile.dto';

type AvatarUpload = { buffer: Buffer; mimetype: string; size: number };

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Get('me')
  me(@CurrentUser() user: JwtUser) {
    return this.authService.me(user.id);
  }

  @Patch('profile')
  updateProfile(@CurrentUser() user: JwtUser, @Body() dto: UpdateProfileDto) {
    return this.authService.updateProfile(user.id, dto);
  }

  @Post('avatar')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  uploadAvatar(@CurrentUser() user: JwtUser, @UploadedFile() file: AvatarUpload) {
    return this.authService.uploadAvatar(user.id, file);
  }

  @Delete('avatar')
  removeAvatar(@CurrentUser() user: JwtUser) {
    return this.authService.removeAvatar(user.id);
  }

  @Post('change-password')
  changePassword(@CurrentUser() user: JwtUser, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(user.id, dto);
  }
}
