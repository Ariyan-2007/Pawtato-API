import { Body, Controller, Param, Post, Get, UseGuards } from '@nestjs/common';

import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { MedicalService } from './medical.service';
import { CreateMedicalRecordDto } from './dto/create-medical-record.dto';

@ApiTags('Medical Records')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('pets/:petId/medical-records')
export class MedicalController {
  constructor(private readonly medicalService: MedicalService) {}

  @ApiOperation({ summary: 'Add a medical record to a pet' })
  @ApiParam({ name: 'petId', description: 'Pet ID' })
  @ApiResponse({ status: 201, description: 'Medical record created.' })
  @ApiResponse({
    status: 404,
    description: 'Pet not found or not owned by the caller.',
  })
  @Post()
  create(
    @CurrentUser() user: JwtPayload,

    @Param('petId')
    petId: string,

    @Body()
    dto: CreateMedicalRecordDto,
  ) {
    return this.medicalService.create(user.sub, petId, dto);
  }

  @ApiOperation({ summary: "List a pet's medical records" })
  @ApiParam({ name: 'petId', description: 'Pet ID' })
  @ApiResponse({ status: 200, description: 'Array of medical records.' })
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
    return this.medicalService.findAll(user.sub, petId);
  }
}
