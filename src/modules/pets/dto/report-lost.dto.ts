import { IsNumber, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ReportLostDto {
  @ApiProperty({ example: 'Dhanmondi, Dhaka' })
  @IsString()
  lastSeenLocation!: string;

  @ApiProperty({ example: 'Last seen near Road 27, wearing a red collar.' })
  @IsString()
  lostDescription!: string;

  @ApiProperty({ example: '+8801XXXXXXXXX' })
  @IsString()
  emergencyContact!: string;

  @ApiPropertyOptional({ example: 50, description: 'Optional reward amount' })
  @IsOptional()
  @IsNumber()
  reward?: number;
}
