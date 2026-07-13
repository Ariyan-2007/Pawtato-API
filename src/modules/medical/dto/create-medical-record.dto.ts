import {
  IsDateString,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateMedicalRecordDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  diagnosis?: string;

  @IsOptional()
  @IsString()
  treatment?: string;

  @IsOptional()
  @IsString()
  veterinarian?: string;

  @IsOptional()
  @IsString()
  clinic?: string;

  @IsOptional()
  @IsDateString()
  visitDate?: Date;

  @IsOptional()
  @IsString()
  notes?: string;
}