import { ArrayMaxSize, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

import { LandingPageSectionDto } from './landing-page-section.dto';

export class UpdateLandingPageDto {
  @ApiProperty({ type: [LandingPageSectionDto] })
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => LandingPageSectionDto)
  sections!: LandingPageSectionDto[];
}
