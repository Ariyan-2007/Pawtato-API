import { Controller, Get } from '@nestjs/common';

import {
  ApiBearerAuth,
  ApiTags,
} from '@nestjs/swagger';

import { ActivityService } from './activity.service';

@ApiTags('Activity')
@ApiBearerAuth('JWT-auth')
@Controller('activity')
export class ActivityController {
  constructor(
    private readonly activityService: ActivityService,
  ) {}

  @Get()
  findAll() {
    return this.activityService.findAll();
  }
}