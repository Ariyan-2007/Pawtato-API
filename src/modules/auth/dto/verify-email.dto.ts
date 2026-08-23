import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyEmailDto {
  @ApiProperty({
    description: 'The token from the verification link (query param `token`).',
  })
  @IsString()
  @IsNotEmpty()
  token!: string;
}
