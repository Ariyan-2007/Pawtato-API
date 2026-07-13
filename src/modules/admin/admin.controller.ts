import {
  Controller,
  Get,
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

@ApiTags('Admin')
@ApiBearerAuth('JWT-auth')

@UseGuards(
  JwtAuthGuard,
  RolesGuard,
)

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
}