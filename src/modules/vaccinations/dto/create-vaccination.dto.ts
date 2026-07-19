import {
  IsDateString,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateVaccinationDto {
  @IsString()
  vaccineName!: string;

  @IsDateString()
  administeredDate!: Date;

  @IsDateString()
  nextDueDate!: Date;

  @IsOptional()
  @IsString()
  veterinarian?: string;

  @IsOptional()
  @IsString()
  clinic?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}