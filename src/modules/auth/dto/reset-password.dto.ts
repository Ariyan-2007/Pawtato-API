import { IsEmail, IsString, Matches, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {
  @ApiProperty({ example: 'sarah@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({
    example: '483920',
    description: 'The 6-digit code sent to the email address.',
  })
  @IsString()
  @Matches(/^\d{6}$/, { message: 'code must be a 6-digit number' })
  code!: string;

  @ApiProperty({ example: 'NewStrongPass123', minLength: 8 })
  @MinLength(8)
  newPassword!: string;
}
