import { IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateProfileDto {
  @IsString()
  @MinLength(1, { message: '姓名不能为空' })
  @MaxLength(20, { message: '姓名最多 20 个字符' })
  name!: string;
}
