import { IsEnum, IsInt, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { LeaveStatus } from '@prisma/client';

export class CreateTeamApplicationDto {
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason!: string;
}

export class ReviewTeamApplicationDto {
  @IsEnum(LeaveStatus)
  status!: LeaveStatus;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  reviewComment?: string;
}

export class CreateTeamInvitationDto {
  @IsInt()
  inviteeId!: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  message?: string;
}

export class ReviewInvitationDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  message?: string;
}

export class JoinTeamByCodeDto {
  @IsString()
  @MinLength(6)
  @MaxLength(6)
  code!: string;
}
