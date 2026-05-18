import { IsEnum, IsInt, IsISO8601, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum AnalyticsGranularity {
  DAY   = 'day',
  WEEK  = 'week',
  MONTH = 'month',
}

export class AnalyticsQueryDto {
  @ApiPropertyOptional({
    description: 'Start of the date range (ISO 8601). Defaults to 30 days ago.',
    example: '2025-01-01',
  })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({
    description: 'End of the date range (ISO 8601). Defaults to today.',
    example: '2025-12-31',
  })
  @IsOptional()
  @IsISO8601()
  to?: string;

  @ApiPropertyOptional({
    enum: AnalyticsGranularity,
    description: 'Time bucket granularity for trend queries (default: day)',
    default: AnalyticsGranularity.DAY,
  })
  @IsOptional()
  @IsEnum(AnalyticsGranularity)
  granularity?: AnalyticsGranularity = AnalyticsGranularity.DAY;

  @ApiPropertyOptional({
    description: 'Number of results for top-N queries (default: 10, max: 50)',
    minimum: 1,
    maximum: 50,
    default: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 10;
}
