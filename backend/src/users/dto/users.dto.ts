import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Role, UserStatus } from '@prisma/client';

export class CreateUserDto {
  @IsString()
  username: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  @MinLength(6, { message: '初始密码至少 6 位' })
  password?: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  @IsInt()
  teamId?: number;

  @IsOptional()
  @IsString()
  phone?: string;
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  @IsInt()
  teamId?: number | null;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;
}

export class ImportUsersDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateUserDto)
  users: CreateUserDto[];
}

export class ResetPasswordDto {
  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;
}
