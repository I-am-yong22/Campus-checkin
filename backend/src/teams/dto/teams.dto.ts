import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class CreateTeamDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;
}

export class UpdateTeamDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;
}

export class UpdateRuleDto {
  @IsOptional()
  @IsString()
  startTime?: string;

  @IsOptional()
  @IsString()
  lateTime?: string;

  @IsOptional()
  @IsString()
  endTime?: string;

  @IsOptional()
  @IsString()
  checkOutStart?: string;

  @IsOptional()
  @IsString()
  checkOutEnd?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
