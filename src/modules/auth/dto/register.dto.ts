import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'Sarah Ahmed' })
  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @ApiProperty({ example: 'sarah@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'StrongPass123', minLength: 8 })
  @MinLength(8)
  password!: string;
}
