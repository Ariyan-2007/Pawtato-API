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

import { NotificationsService } from './notifications.service';
import { NotificationQueryDto } from './dto/notification-query.dto';
import { BulkDeleteNotificationsDto } from './dto/bulk-delete-notifications.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@ApiTags('Notifications')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @ApiOperation({ summary: "List the current user's in-app notifications" })
  @ApiResponse({
    status: 200,
    description: 'Paginated notifications, newest first.',
  })
  @Get()
  findAll(
    @CurrentUser() user: JwtPayload,

    @Query()
    query: NotificationQueryDto,
  ) {
    return this.notificationsService.findForUser(user.sub, query);
  }

  @ApiOperation({
    summary: "Mark all of the current user's notifications as read",
  })
  @ApiResponse({
    status: 200,
    description: 'Number of notifications updated.',
  })
  @Patch('read-all')
  markAllRead(@CurrentUser() user: JwtPayload) {
    return this.notificationsService.markAllRead(user.sub);
  }

  @ApiOperation({ summary: 'Mark a notification as read' })
  @ApiParam({ name: 'id', description: 'Notification ID' })
  @ApiResponse({ status: 200, description: 'The updated notification.' })
  @ApiResponse({
    status: 404,
    description: 'Notification not found or not owned by the caller.',
  })
  @Patch(':id/read')
  markRead(
    @CurrentUser() user: JwtPayload,

    @Param('id')
    notificationId: string,
  ) {
    return this.notificationsService.markRead(user.sub, notificationId);
  }

  @ApiOperation({
    summary: 'Delete multiple notifications at once, regardless of priority',
  })
  @ApiResponse({ status: 200, description: 'Number of notifications deleted.' })
  @Delete()
  deleteMany(
    @CurrentUser() user: JwtPayload,

    @Body()
    dto: BulkDeleteNotificationsDto,
  ) {
    return this.notificationsService.deleteMany(user.sub, dto.ids);
  }

  @ApiOperation({
    summary: 'Delete a single notification, regardless of priority',
  })
  @ApiParam({ name: 'id', description: 'Notification ID' })
  @ApiResponse({ status: 200, description: 'Notification deleted.' })
  @ApiResponse({
    status: 404,
    description: 'Notification not found or not owned by the caller.',
  })
  @Delete(':id')
  deleteOne(
    @CurrentUser() user: JwtPayload,

    @Param('id')
    notificationId: string,
  ) {
    return this.notificationsService.delete(user.sub, notificationId);
  }
}
