import { IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ToggleSectionDto {
  @ApiProperty({ example: false })
  @IsBoolean()
  enabled!: boolean;
}
