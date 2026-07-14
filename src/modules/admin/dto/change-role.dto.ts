import { IsEnum } from 'class-validator';

import { UserRole } from '../../../common/enums/user-role.enum';

export class ChangeRoleDto {
  @IsEnum(UserRole)
  role!: UserRole;
}