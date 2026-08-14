import { IsEmail, IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StoreRole } from '@prisma/client';

export class InviteStaffDto {
  @ApiProperty({ example: 'rahul@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ enum: ['ADMIN', 'MANAGER', 'STAFF'], example: 'STAFF' })
  @IsEnum(['ADMIN', 'MANAGER', 'STAFF'])
  role: 'ADMIN' | 'MANAGER' | 'STAFF';

  @ApiPropertyOptional({ example: 'Rahul Sharma' })
  @IsOptional()
  @IsString()
  name?: string;
}
