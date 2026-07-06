import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class SaveCarouselSlideDto {
  @IsOptional()
  @IsInt()
  id?: number;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class SaveCountdownDto {
  @IsOptional()
  @IsInt()
  id?: number;

  @IsString()
  title: string;

  @IsString()
  targetAt: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class MissionGapDto {
  @IsString()
  deliverable: string;

  @IsString()
  assignees: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class MissionProgressDto {
  @IsString()
  label: string;

  @IsInt()
  @Min(0)
  @Max(100)
  percent: number;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class SaveMissionBoardDto {
  @IsOptional()
  @IsInt()
  id?: number;

  @IsOptional()
  @IsInt()
  teamId?: number;

  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  deadlineAt?: string;

  @IsOptional()
  @IsString()
  headline?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MissionGapDto)
  gaps?: MissionGapDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MissionProgressDto)
  progress?: MissionProgressDto[];
}

export class SaveBirthdayDto {
  @IsOptional()
  @IsInt()
  id?: number;

  @IsInt()
  userId: number;

  @IsString()
  date: string;

  @IsString()
  startTime: string;

  @IsOptional()
  @IsString()
  message?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
