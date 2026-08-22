import { Controller, Get, Param, UseGuards } from '@nestjs/common';

import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { FoundReportsService } from './found-reports.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@ApiTags('Found Reports')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('pets/:petId/found-reports')
export class FoundReportsController {
  constructor(private readonly foundReportsService: FoundReportsService) {}

  @ApiOperation({ summary: 'List found reports submitted for a pet' })
  @ApiParam({ name: 'petId', description: 'Pet ID' })
  @ApiResponse({
    status: 200,
    description: 'Array of found reports, newest first.',
  })
  @ApiResponse({
    status: 404,
    description: 'Pet not found or not owned by the caller.',
  })
  @Get()
  findAll(
    @CurrentUser() user: JwtPayload,

    @Param('petId')
    petId: string,
  ) {
    return this.foundReportsService.findForOwnedPet(user.sub, petId);
  }
}
