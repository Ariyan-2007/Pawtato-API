import {
  IsBoolean,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePetDto {
  @ApiProperty({ example: 'Milo' })
  @IsString()
  name!: string;

  @ApiProperty({ example: 'Cat', description: 'e.g. Cat, Dog' })
  @IsString()
  species!: string;

  @ApiPropertyOptional({ example: 'Persian' })
  @IsOptional()
  @IsString()
  breed?: string;

  @ApiPropertyOptional({ example: 'Male' })
  @IsOptional()
  @IsString()
  gender?: string;

  @ApiPropertyOptional({ example: 'White' })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional({ example: '2022-05-01' })
  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @ApiPropertyOptional({ example: 4.2, description: 'Weight in kilograms' })
  @IsOptional()
  @IsNumber()
  weight?: number;

  @ApiPropertyOptional({
    example: 'Friendly but startles easily — approach calmly.',
    description:
      'One safety-relevant trait a stranger should know before approaching. Shown on the public scan profile.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  notableTrait?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isLost?: boolean;
}
