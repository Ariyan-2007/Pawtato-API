import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class StatItemDto {
  @ApiProperty({ example: 'Pets protected' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  label!: string;

  // Kept a free-form string (not a number) — display values like "10K+" or
  // "99.9%" are common on landing pages and shouldn't need a second field.
  @ApiProperty({ example: '10,000+' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  value!: string;

  @ApiPropertyOptional({ example: 'paw' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  icon?: string;
}
