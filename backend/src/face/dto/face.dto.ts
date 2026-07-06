import { ArrayMaxSize, ArrayMinSize, IsArray, IsNumber, IsOptional } from 'class-validator';

export class RegisterFaceDto {
  @IsOptional()
  @IsArray()
  @ArrayMinSize(128)
  @ArrayMaxSize(128)
  @IsNumber({}, { each: true })
  descriptor?: number[];
}
