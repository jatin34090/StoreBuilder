import { IsArray, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { VehicleType } from './create-agent.dto';

export class UpdateAgentDto {
  @ApiPropertyOptional({ enum: VehicleType, description: 'Primary vehicle type' })
  @IsOptional()
  @IsEnum(VehicleType)
  vehicleType?: VehicleType;

  @ApiPropertyOptional({
    type: [String],
    description: 'Serviceable pincodes (replaces the existing list)',
    example: ['400001', '400005'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(10, { each: true })
  zones?: string[];
}
