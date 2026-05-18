import { IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ModerateReviewDto {
  @ApiProperty({ description: 'true = visible to public, false = hidden' })
  @IsBoolean()
  isVisible: boolean;
}
