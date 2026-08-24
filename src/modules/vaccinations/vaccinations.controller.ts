import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';

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

import { VaccinationsService } from './vaccinations.service';
import { ParseMongoIdPipe } from '../../common/pipes/parse-mongo-id.pipe';
import { CreateVaccinationDto } from './dto/create-vaccination.dto';

@ApiTags('Vaccinations')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('pets/:petId/vaccinations')
export class VaccinationsController {
  constructor(private readonly vaccinationsService: VaccinationsService) {}

  @ApiOperation({ summary: 'Add a vaccination record to a pet' })
  @ApiParam({ name: 'petId', description: 'Pet ID' })
  @ApiResponse({ status: 201, description: 'Vaccination record created.' })
  @ApiResponse({
    status: 404,
    description: 'Pet not found or not owned by the caller.',
  })
  @Post()
  create(
    @CurrentUser() user: JwtPayload,

    @Param('petId', ParseMongoIdPipe)
    petId: string,

    @Body()
    dto: CreateVaccinationDto,
  ) {
    return this.vaccinationsService.create(user.sub, petId, dto);
  }

  @ApiOperation({ summary: "List a pet's vaccination records" })
  @ApiParam({ name: 'petId', description: 'Pet ID' })
  @ApiResponse({ status: 200, description: 'Array of vaccination records.' })
  @ApiResponse({
    status: 404,
    description: 'Pet not found or not owned by the caller.',
  })
  @Get()
  findAll(
    @CurrentUser() user: JwtPayload,

    @Param('petId', ParseMongoIdPipe)
    petId: string,
  ) {
    return this.vaccinationsService.findAll(user.sub, petId);
  }
}
