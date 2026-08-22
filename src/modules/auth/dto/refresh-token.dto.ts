import { IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RefreshTokenDto {
  @ApiProperty({ description: 'A previously issued refresh token' })
  @IsNotEmpty()
  refreshToken!: string;
}
