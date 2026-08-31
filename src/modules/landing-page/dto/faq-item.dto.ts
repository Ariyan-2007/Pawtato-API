import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class FaqItemDto {
  @ApiProperty({ example: 'How does the QR tag work?' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  question!: string;

  @ApiProperty({
    example: 'Anyone who scans it sees your pet profile and your contact info.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  answer!: string;
}
