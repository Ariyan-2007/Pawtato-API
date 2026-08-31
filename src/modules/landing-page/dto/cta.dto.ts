import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CtaDto {
  @ApiProperty({ example: 'Get Started' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  text!: string;

  // Deliberately not @IsUrl — a CTA routinely points at a relative frontend
  // route (e.g. "/signup"), not just absolute URLs.
  @ApiProperty({ example: '/signup' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  @Matches(/^(\/|https?:\/\/)/, {
    message: 'url must start with "/" or be an absolute http(s) URL',
  })
  url!: string;
}
