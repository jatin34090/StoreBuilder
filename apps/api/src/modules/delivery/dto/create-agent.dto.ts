import {
  IsArray,
  ArrayMinSize,
  IsEnum,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum VehicleType {
  BIKE  = 'bike',
  CYCLE = 'cycle',
  FOOT  = 'foot',
}

export class CreateAgentDto {
  @ApiProperty({
    description: 'UUID of the User to register as a delivery agent. The user must already exist.',
    format: 'uuid',
  })
  @IsUUID()
  userId: string;

  @ApiProperty({
    enum: VehicleType,
    description: 'Primary vehicle used for deliveries',
    example: VehicleType.BIKE,
  })
  @IsEnum(VehicleType)
  vehicleType: VehicleType;

  @ApiProperty({
    description: 'Serviceable pincodes for this agent',
    example: ['400001', '400002', '400003'],
    type: [String],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @MaxLength(10, { each: true })
  zones: string[];
}
