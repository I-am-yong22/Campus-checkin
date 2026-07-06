import { IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsString()
  username: string;

  @IsString()
  password: string;
}

export class ChangePasswordDto {
  @IsString()
  oldPassword: string;

  @IsString()
  @MinLength(6, { message: '新密码至少 6 位' })
  newPassword: string;
}
