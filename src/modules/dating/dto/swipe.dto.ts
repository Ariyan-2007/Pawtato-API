import { IsEnum, IsMongoId } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

import { SwipeAction } from '../../../common/enums/swipe-action.enum';

export class SwipeDto {
  @ApiProperty({ description: 'The caller-owned pet doing the swiping.' })
  @IsMongoId()
  fromPetId!: string;

  @ApiProperty({ description: 'The pet being swiped on.' })
  @IsMongoId()
  toPetId!: string;

  @ApiProperty({ enum: SwipeAction, example: SwipeAction.LIKE })
  @IsEnum(SwipeAction)
  action!: SwipeAction;
}
