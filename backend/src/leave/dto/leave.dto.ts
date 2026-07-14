import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export class CreateLeaveDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'startDate 格式应为 YYYY-MM-DD' })
  startDate!: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'endDate 格式应为 YYYY-MM-DD' })
  endDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  type?: string;

  @IsString()
  @MaxLength(500)
  reason!: string;

  /** 普通用户必选：LEADER 项目负责人 / ADMIN 管理员；负责人提交时忽略 */
  @IsOptional()
  @IsIn(['LEADER', 'ADMIN'])
  reviewTarget?: 'LEADER' | 'ADMIN';

  /** 单日可选：FULL_DAY 整天 / HOURLY 按小时 */
  @IsOptional()
  @IsIn(['FULL_DAY', 'HOURLY'])
  leaveMode?: 'FULL_DAY' | 'HOURLY';

  @ValidateIf((o) => o.leaveMode === 'HOURLY')
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'startTime 格式应为 HH:mm' })
  startTime?: string;

  @ValidateIf((o) => o.leaveMode === 'HOURLY')
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(23)
  durationHours?: number;

  @ValidateIf((o) => o.leaveMode === 'HOURLY')
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(59)
  durationMinutes?: number;
}

export class ReviewLeaveDto {
  @IsIn(['APPROVED', 'REJECTED'])
  status!: 'APPROVED' | 'REJECTED';

  @IsOptional()
  @IsString()
  @MaxLength(200)
  reviewComment?: string;
}
