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
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { ChangeRoleDto } from './dto/change-role.dto';
import { AdminUserQueryDto } from './dto/admin-user-query.dto';
import { AdminPetQueryDto } from './dto/admin-pet-query.dto';
import { DashboardStatsDto } from './dto/dashboard-stats.dto';
import { DashboardAnalyticsDto } from './dto/dashboard-analytics.dto';

@ApiTags('Admin')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @ApiOperation({ summary: 'Get dashboard summary statistics (admin only)' })
  @ApiResponse({ status: 200, type: DashboardStatsDto })
  @Get('dashboard')
  dashboard() {
    return this.adminService.dashboard();
  }

  @ApiOperation({ summary: 'Search/list users (admin only)' })
  @ApiResponse({ status: 200, description: 'Paginated list of users.' })
  @Get('users')
  findAllUsers(
    @Query()
    query: AdminUserQueryDto,
  ) {
    return this.adminService.users(query);
  }

  @ApiOperation({ summary: 'Get a single user by ID (admin only)' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'The user.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  @Get('users/:id')
  findUser(
    @Param('id')
    id: string,
  ) {
    return this.adminService.user(id);
  }

  @ApiOperation({ summary: 'Block a user (admin only)' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'User blocked.' })
  @Patch('users/:id/block')
  blockUser(
    @Param('id')
    id: string,
  ) {
    return this.adminService.block(id);
  }

  @ApiOperation({ summary: 'Unblock a user (admin only)' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'User unblocked.' })
  @Patch('users/:id/unblock')
  unblockUser(
    @Param('id')
    id: string,
  ) {
    return this.adminService.unblock(id);
  }

  @ApiOperation({ summary: "Change a user's role (admin only)" })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'Role updated.' })
  @Patch('users/:id/role')
  changeRole(
    @Param('id')
    id: string,

    @Body()
    dto: ChangeRoleDto,
  ) {
    return this.adminService.changeRole(id, dto.role);
  }

  @ApiOperation({ summary: 'Delete a user (admin only)' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'User deleted.' })
  @Delete('users/:id')
  deleteUser(
    @Param('id')
    id: string,
  ) {
    return this.adminService.delete(id);
  }

  @ApiOperation({ summary: 'Search/list pets (admin only)' })
  @ApiResponse({ status: 200, description: 'Paginated list of pets.' })
  @Get('pets')
  findAllPets(
    @Query()
    query: AdminPetQueryDto,
  ) {
    return this.adminService.pets(query);
  }

  @ApiOperation({ summary: 'Get a single pet by ID (admin only)' })
  @ApiParam({ name: 'id', description: 'Pet ID' })
  @ApiResponse({ status: 200, description: 'The pet.' })
  @ApiResponse({ status: 404, description: 'Pet not found.' })
  @Get('pets/:id')
  findPet(
    @Param('id')
    id: string,
  ) {
    return this.adminService.pet(id);
  }

  @ApiOperation({ summary: 'Force-mark a pet as recovered (admin only)' })
  @ApiParam({ name: 'id', description: 'Pet ID' })
  @ApiResponse({ status: 200, description: 'Pet marked as recovered.' })
  @Patch('pets/:id/recover')
  recoverPet(
    @Param('id')
    id: string,
  ) {
    return this.adminService.recoverPet(id);
  }

  @ApiOperation({ summary: 'Delete a pet (admin only)' })
  @ApiParam({ name: 'id', description: 'Pet ID' })
  @ApiResponse({ status: 200, description: 'Pet deleted.' })
  @Delete('pets/:id')
  deletePet(
    @Param('id')
    id: string,
  ) {
    return this.adminService.deletePet(id);
  }

  @ApiOperation({ summary: 'Get platform analytics (admin only)' })
  @ApiResponse({ status: 200, type: DashboardAnalyticsDto })
  @Get('analytics')
  analytics() {
    return this.adminService.analytics();
  }
}
