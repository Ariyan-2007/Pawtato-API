import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';

import { UserRole } from '../../../common/enums/user-role.enum';

export class BroadcastNotificationDto {
  @ApiProperty({ example: 'New: shared pet access is here' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title!: string;

  @ApiProperty({
    example:
      'You can now grant a vet or family member access to a pet from its profile page.',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  message!: string;

  @ApiPropertyOptional({
    enum: UserRole,
    description:
      'Restrict the announcement to one role (e.g. USER-only, ADMIN-only). Omit to reach every active account.',
  })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}
