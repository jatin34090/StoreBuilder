import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpsertSettingDto {
  @ApiProperty({ example: 'primary_color' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  key: string;

  @ApiProperty({ example: '#C9A84C' })
  @IsString()
  @IsNotEmpty()
  value: string;
}
