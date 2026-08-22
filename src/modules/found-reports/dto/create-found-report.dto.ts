import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateFoundReportDto {
  @ApiProperty({
    example: 'Found near Road 27, looks healthy and friendly.',
    description: 'A message from the finder to the owner.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  message!: string;

  @ApiPropertyOptional({ example: 'Dhanmondi, Dhaka' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  approxLocation?: string;

  @ApiPropertyOptional({
    example: '+8801XXXXXXXXX',
    description: 'Optional way for the owner to reach the finder back.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  contactInfo?: string;
}
