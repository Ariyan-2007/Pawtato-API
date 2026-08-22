import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTagDto {
  @ApiPropertyOptional({
    example: 'SN-8F2K91AQ',
    description: 'Manufacturer serial number. Auto-generated if omitted.',
  })
  @IsOptional()
  @IsString()
  serialNumber?: string;
}
