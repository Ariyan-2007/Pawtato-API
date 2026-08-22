import { IsDateString, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateMedicalRecordDto {
  @ApiProperty({ example: 'Annual checkup' })
  @IsString()
  title!: string;

  @ApiPropertyOptional({ example: 'Mild ear infection' })
  @IsOptional()
  @IsString()
  diagnosis?: string;

  @ApiPropertyOptional({ example: 'Prescribed ear drops for 7 days' })
  @IsOptional()
  @IsString()
  treatment?: string;

  @ApiPropertyOptional({ example: 'Dr. Rahman' })
  @IsOptional()
  @IsString()
  veterinarian?: string;

  @ApiPropertyOptional({ example: 'City Vet Clinic' })
  @IsOptional()
  @IsString()
  clinic?: string;

  @ApiPropertyOptional({ example: '2026-01-15' })
  @IsOptional()
  @IsDateString()
  visitDate?: Date;

  @ApiPropertyOptional({ example: 'Follow up in two weeks.' })
  @IsOptional()
  @IsString()
  notes?: string;
}
