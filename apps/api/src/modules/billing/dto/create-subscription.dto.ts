import { IsEnum } from 'class-validator';
import { Plan } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSubscriptionDto {
  @ApiProperty({ enum: Plan, example: Plan.STARTER })
  @IsEnum(Plan)
  plan: Plan;
}
