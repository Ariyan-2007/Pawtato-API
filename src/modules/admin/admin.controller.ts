import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';

import {
  ApiBearerAuth,
  ApiTags,
} from '@nestjs/swagger';

import { AdminService } from './admin.service';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';

import { Roles } from '../../common/decorators/roles.decorator';

import { UserRole } from '../../common/enums/user-role.enum';

import { ChangeRoleDto } from './dto/change-role.dto';
import { AdminUserQueryDto } from './dto/admin-user-query.dto';

@ApiTags('Admin')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
  ) {}

  @Get('dashboard')
  dashboard() {
    return this.adminService.dashboard();
  }

  @Get('users')
  findAllUsers(
    @Query()
    query: AdminUserQueryDto,
  ) {
    return this.adminService.users(query);
  }

  @Get('users/:id')
  findUser(
    @Param('id')
    id: string,
  ) {
    return this.adminService.user(id);
  }

  @Patch('users/:id/block')
  blockUser(
    @Param('id')
    id: string,
  ) {
    return this.adminService.block(id);
  }

  @Patch('users/:id/unblock')
  unblockUser(
    @Param('id')
    id: string,
  ) {
    return this.adminService.unblock(id);
  }

  @Patch('users/:id/role')
  changeRole(
    @Param('id')
    id: string,

    @Body()
    dto: ChangeRoleDto,
  ) {
    return this.adminService.changeRole(
      id,
      dto.role,
    );
  }

  @Delete('users/:id')
  deleteUser(
    @Param('id')
    id: string,
  ) {
    return this.adminService.delete(id);
  }
}