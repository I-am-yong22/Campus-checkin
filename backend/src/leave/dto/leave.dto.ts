import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

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
}

export class ReviewLeaveDto {
  @IsIn(['APPROVED', 'REJECTED'])
  status!: 'APPROVED' | 'REJECTED';

  @IsOptional()
  @IsString()
  @MaxLength(200)
  reviewComment?: string;
}
