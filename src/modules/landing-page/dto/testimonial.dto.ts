import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TestimonialDto {
  @ApiProperty({ example: 'Ariyan J.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({ example: 'Dog owner' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  role?: string;

  @ApiPropertyOptional({ example: 'https://cdn.pawtato.app/avatars/1.jpg' })
  @IsOptional()
  @IsUrl({ require_tld: false })
  avatar?: string;

  @ApiProperty({ example: 'Found my dog within an hour of him going missing!' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  quote!: string;

  @ApiPropertyOptional({ example: 5, minimum: 1, maximum: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;
}
