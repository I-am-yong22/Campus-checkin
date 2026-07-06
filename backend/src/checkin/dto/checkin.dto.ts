import { IsDateString, IsInt, IsString, MinLength } from 'class-validator';

export class MakeupCheckInDto {
  @IsInt()
  userId!: number;

  @IsDateString()
  date!: string;

  @IsString()
  @MinLength(1)
  remark!: string;
}
