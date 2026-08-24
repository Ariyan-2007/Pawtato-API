import { IsMongoId, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateDatingReportDto {
  @ApiProperty({ description: "The reported pet's dating profile." })
  @IsMongoId()
  targetPetId!: string;

  @ApiProperty({ example: 'Profile photos are of a different animal.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason!: string;
}
