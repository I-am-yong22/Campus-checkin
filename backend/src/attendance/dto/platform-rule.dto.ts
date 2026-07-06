import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdatePlatformRuleDto {
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
