import {
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class ReportLostDto {
  @IsString()
  lastSeenLocation!: string;

  @IsString()
  lostDescription!: string;

  @IsString()
  emergencyContact!: string;

  @IsOptional()
  @IsNumber()
  reward?: number;
}