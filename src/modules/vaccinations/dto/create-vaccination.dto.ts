import { IsDateString, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateVaccinationDto {
  @ApiProperty({ example: 'Rabies' })
  @IsString()
  vaccineName!: string;

  @ApiProperty({ example: '2026-01-15' })
  @IsDateString()
  administeredDate!: Date;

  @ApiProperty({ example: '2027-01-15' })
  @IsDateString()
  nextDueDate!: Date;

  @ApiPropertyOptional({ example: 'Dr. Rahman' })
  @IsOptional()
  @IsString()
  veterinarian?: string;

  @ApiPropertyOptional({ example: 'City Vet Clinic' })
  @IsOptional()
  @IsString()
  clinic?: string;

  @ApiPropertyOptional({ example: 'No adverse reaction observed.' })
  @IsOptional()
  @IsString()
  notes?: string;
}
