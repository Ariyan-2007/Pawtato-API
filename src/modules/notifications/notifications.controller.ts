import {
  Controller,
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
}
