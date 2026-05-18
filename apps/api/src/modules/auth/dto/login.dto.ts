import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'admin@yourdomain.in' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'your_password' })
  @IsString()
  @MinLength(8)
  password: string;
}
