import { Body, Controller, Get, Post } from '@nestjs/common';
import { CurrentUser, JwtUser } from '../auth/decorators/current-user.decorator';
import { RegisterFaceDto } from './dto/face.dto';
import { FaceService } from './face.service';

@Controller('face')
export class FaceController {
  constructor(private readonly faceService: FaceService) {}

  @Post('register')
  register(@CurrentUser() user: JwtUser, @Body() dto: RegisterFaceDto) {
    return this.faceService.register(user.id, dto.descriptor!);
  }

  @Get('status')
  status(@CurrentUser() user: JwtUser) {
    return this.faceService.status(user.id);
  }
}
