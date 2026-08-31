import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class FeatureItemDto {
  @ApiProperty({ example: 'Digital Pet ID' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  title!: string;

  @ApiPropertyOptional({ example: 'A QR tag that links to your pet profile.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ example: 'qr-code', description: 'Icon identifier' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  icon?: string;

  @ApiPropertyOptional({ example: 'https://cdn.pawtato.app/features/id.png' })
  @IsOptional()
  @IsUrl({ require_tld: false })
  image?: string;
}
