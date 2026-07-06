import { IsOptional, IsString } from 'class-validator';

export class CreateAttendanceTaskDto {
  @IsString()
  date: string;

  @IsOptional()
  @IsString()
  checkInStart?: string;

  @IsOptional()
  @IsString()
  lateTime?: string;

  @IsOptional()
  @IsString()
  checkInEnd?: string;

  @IsOptional()
  @IsString()
  checkOutStart?: string;

  @IsOptional()
  @IsString()
  checkOutEnd?: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class UpdateAttendanceTaskDto {
  @IsOptional()
  @IsString()
  checkInStart?: string;

  @IsOptional()
  @IsString()
  lateTime?: string;

  @IsOptional()
  @IsString()
  checkInEnd?: string;

  @IsOptional()
  @IsString()
  checkOutStart?: string;

  @IsOptional()
  @IsString()
  checkOutEnd?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
