import { IsDateString, IsInt, IsOptional, IsString } from 'class-validator';

export class CreateExemptionDto {
  @IsDateString()
  date!: string;

  @IsOptional()
  @IsInt()
  teamId?: number;

  @IsOptional()
  @IsString()
  reason?: string;
}
