import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { DatingPurpose } from '../../../common/enums/dating-purpose.enum';

export class CreateDatingProfileDto {
  @ApiProperty({ enum: DatingPurpose, example: DatingPurpose.PLAYDATE })
  @IsEnum(DatingPurpose)
  purpose!: DatingPurpose;

  @ApiPropertyOptional({ example: 'Loves fetch and long walks in the park.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;

  @ApiPropertyOptional({ example: ['playful', 'good-with-kids'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  temperamentTags?: string[];

  @ApiPropertyOptional({
    description:
      'Already-hosted image URLs (e.g. from the same upload endpoint used for pet photos) — this module has no dedicated photo-upload endpoint of its own.',
    example: ['https://your-app.example/uploads/pets/photo1.png'],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsUrl({}, { each: true })
  photos?: string[];

  @ApiPropertyOptional({
    example: 'Dhanmondi, Dhaka',
    description:
      'Coarse only — a city/area name or a lat/lng already rounded by the client. Never the precise address.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  approxLocation?: string;
}
