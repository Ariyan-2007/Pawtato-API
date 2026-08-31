import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

import { CtaDto } from './cta.dto';
import { FeatureItemDto } from './feature-item.dto';
import { StatItemDto } from './stat-item.dto';
import { TestimonialDto } from './testimonial.dto';
import { FaqItemDto } from './faq-item.dto';

// Every field is optional here — which ones are meaningful depends on the
// section's `key` (e.g. `items` for FEATURES, `faqs` for FAQ). This is the
// deliberate middle ground between a fully rigid per-section schema and an
// unstructured blob: each field that IS present is strongly typed and
// validated, but a section only sends the fields its own renderer needs.
export class LandingPageSectionContentDto {
  @ApiPropertyOptional({ example: 'Give Your Pet a Better Life' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({ example: 'Digital ID tags for pets, made simple.' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  subtitle?: string;

  @ApiPropertyOptional({
    example: 'Scan the tag, see the profile, reunite with your pet.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ example: 'https://cdn.pawtato.app/hero.png' })
  @IsOptional()
  @IsUrl({ require_tld: false })
  image?: string;

  @ApiPropertyOptional({ example: 'https://cdn.pawtato.app/hero.mp4' })
  @IsOptional()
  @IsUrl({ require_tld: false })
  video?: string;

  @ApiPropertyOptional({ type: CtaDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CtaDto)
  primaryCta?: CtaDto;

  @ApiPropertyOptional({ type: CtaDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CtaDto)
  secondaryCta?: CtaDto;

  @ApiPropertyOptional({ type: [FeatureItemDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => FeatureItemDto)
  items?: FeatureItemDto[];

  @ApiPropertyOptional({ type: [StatItemDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => StatItemDto)
  stats?: StatItemDto[];

  @ApiPropertyOptional({ type: [TestimonialDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => TestimonialDto)
  testimonials?: TestimonialDto[];

  @ApiPropertyOptional({ type: [FaqItemDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => FaqItemDto)
  faqs?: FaqItemDto[];
}
