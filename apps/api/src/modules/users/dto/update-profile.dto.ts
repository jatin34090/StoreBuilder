import { IsString, IsOptional, IsDateString, MaxLength, MinLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Priya Sharma' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ example: 'cloudinary_public_id_here', description: 'Cloudinary public_id of uploaded avatar' })
  @IsOptional()
  @IsString()
  avatar?: string;

  @ApiPropertyOptional({ example: '1995-08-15', description: 'Date of birth for birthday offers (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  dob?: string;
}
