import {
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ReportLostDto {
  @ApiProperty({ example: 'Dhanmondi, Dhaka' })
  @IsString()
  @MaxLength(200)
  lastSeenLocation!: string;

  @ApiProperty({ example: 'Last seen near Road 27, wearing a red collar.' })
  @IsString()
  @MaxLength(1000)
  lostDescription!: string;

  @ApiProperty({ example: '+8801XXXXXXXXX' })
  @IsString()
  @MaxLength(50)
  emergencyContact!: string;

  @ApiPropertyOptional({ example: 50, description: 'Optional reward amount' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10_000_000)
  reward?: number;
}
