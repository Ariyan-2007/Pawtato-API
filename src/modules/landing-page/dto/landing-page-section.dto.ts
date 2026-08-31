import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { LandingPageSectionKey } from '../../../common/enums/landing-page-section-key.enum';
import { LandingPageSectionContentDto } from './landing-page-section-content.dto';

export class LandingPageSectionDto {
  @ApiProperty({
    enum: LandingPageSectionKey,
    example: LandingPageSectionKey.HERO,
  })
  @IsEnum(LandingPageSectionKey)
  key!: LandingPageSectionKey;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  enabled: boolean = true;

  @ApiProperty({
    example: 1,
    minimum: 1,
    description: 'Display order, ascending.',
  })
  @IsInt()
  @Min(1)
  order!: number;

  @ApiPropertyOptional({ type: LandingPageSectionContentDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => LandingPageSectionContentDto)
  content: LandingPageSectionContentDto = new LandingPageSectionContentDto();
}
