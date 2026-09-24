import { IsString, MaxLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddDomainDto {
  @ApiProperty({ example: 'shop.mybrand.com', description: 'Custom domain to connect (no protocol)' })
  @IsString()
  @MaxLength(253)
  @Matches(/^[a-z0-9]([a-z0-9.-]{0,251}[a-z0-9])?$/, {
    message: 'Domain must be a valid hostname (lowercase, no protocol, no trailing slash)',
  })
  domain!: string;
}
