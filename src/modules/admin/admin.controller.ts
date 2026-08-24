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
import { ParseMongoIdPipe } from '../../common/pipes/parse-mongo-id.pipe';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { ChangeRoleDto } from './dto/change-role.dto';
import { AdminUserQueryDto } from './dto/admin-user-query.dto';
import { AdminPetQueryDto } from './dto/admin-pet-query.dto';
import { AdminFoundReportQueryDto } from './dto/admin-found-report-query.dto';
import { UpdateFoundReportStatusDto } from './dto/update-found-report-status.dto';
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
    @Param('id', ParseMongoIdPipe)
    id: string,
  ) {
    return this.adminService.user(id);
  }

  @ApiOperation({ summary: 'Block a user (admin only)' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'User blocked.' })
  @Patch('users/:id/block')
  blockUser(
    @CurrentUser() user: JwtPayload,

    @Param('id', ParseMongoIdPipe)
    id: string,
  ) {
    return this.adminService.block(user.sub, id);
  }

  @ApiOperation({ summary: 'Unblock a user (admin only)' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'User unblocked.' })
  @Patch('users/:id/unblock')
  unblockUser(
    @CurrentUser() user: JwtPayload,

    @Param('id', ParseMongoIdPipe)
    id: string,
  ) {
    return this.adminService.unblock(user.sub, id);
  }

  @ApiOperation({ summary: "Change a user's role (admin only)" })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'Role updated.' })
  @Patch('users/:id/role')
  changeRole(
    @CurrentUser() user: JwtPayload,

    @Param('id', ParseMongoIdPipe)
    id: string,

    @Body()
    dto: ChangeRoleDto,
  ) {
    return this.adminService.changeRole(user.sub, id, dto.role);
  }

  @ApiOperation({ summary: 'Delete a user (admin only)' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'User deleted.' })
  @Delete('users/:id')
  deleteUser(
    @CurrentUser() user: JwtPayload,

    @Param('id', ParseMongoIdPipe)
    id: string,
  ) {
    return this.adminService.delete(user.sub, id);
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
    @Param('id', ParseMongoIdPipe)
    id: string,
  ) {
    return this.adminService.pet(id);
  }

  @ApiOperation({ summary: 'Force-mark a pet as recovered (admin only)' })
  @ApiParam({ name: 'id', description: 'Pet ID' })
  @ApiResponse({ status: 200, description: 'Pet marked as recovered.' })
  @Patch('pets/:id/recover')
  recoverPet(
    @CurrentUser() user: JwtPayload,

    @Param('id', ParseMongoIdPipe)
    id: string,
  ) {
    return this.adminService.recoverPet(user.sub, id);
  }

  @ApiOperation({ summary: 'Delete a pet (admin only)' })
  @ApiParam({ name: 'id', description: 'Pet ID' })
  @ApiResponse({ status: 200, description: 'Pet deleted.' })
  @Delete('pets/:id')
  deletePet(
    @CurrentUser() user: JwtPayload,

    @Param('id', ParseMongoIdPipe)
    id: string,
  ) {
    return this.adminService.deletePet(user.sub, id);
  }

  @ApiOperation({ summary: 'Get platform analytics (admin only)' })
  @ApiResponse({ status: 200, type: DashboardAnalyticsDto })
  @Get('analytics')
  analytics() {
    return this.adminService.analytics();
  }

  @ApiOperation({
    summary: 'List found reports for abuse review (admin only)',
    description:
      'Global, unscoped by pet/tag ownership — the moderation queue for spam/malicious finder ' +
      'reports. Filter by `status` and/or `deviceFingerprint` (the latter surfaces every report ' +
      'submitted by one device, useful for spotting a farming pattern across many tags).',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of found reports.',
  })
  @Get('found-reports')
  findAllFoundReports(
    @Query()
    query: AdminFoundReportQueryDto,
  ) {
    return this.adminService.foundReports(query);
  }

  @ApiOperation({
    summary: "Update a found report's moderation status (admin only)",
    description:
      'Stamps `reviewedBy`/`reviewedAt` with the acting admin. Does not itself suspend the ' +
      "associated tag — pair with PATCH /tags/{id}/suspend when a report's status warrants it.",
  })
  @ApiParam({ name: 'id', description: 'Found report ID' })
  @ApiResponse({ status: 200, description: 'Found report status updated.' })
  @ApiResponse({ status: 404, description: 'Found report not found.' })
  @Patch('found-reports/:id/status')
  updateFoundReportStatus(
    @CurrentUser() user: JwtPayload,

    @Param('id', ParseMongoIdPipe)
    id: string,

    @Body()
    dto: UpdateFoundReportStatusDto,
  ) {
    return this.adminService.updateFoundReportStatus(user.sub, id, dto.status);
  }
}
