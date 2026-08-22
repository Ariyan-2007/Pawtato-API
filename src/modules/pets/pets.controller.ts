import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { PetsService } from './pets.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { CreatePetDto } from './dto/create-pet.dto';
import { UpdatePetDto } from './dto/update-pet.dto';
import { ReportLostDto } from './dto/report-lost.dto';

@ApiTags('Pets')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('pets')
export class PetsController {
  constructor(private readonly petsService: PetsService) {}

  @ApiOperation({ summary: "List the current user's pets" })
  @ApiResponse({
    status: 200,
    description: 'Array of pets owned by the caller.',
  })
  @Get()
  findAll(@CurrentUser() user: JwtPayload) {
    return this.petsService.findAll(user.sub);
  }

  @ApiOperation({ summary: 'Create a new pet' })
  @ApiResponse({ status: 201, description: 'Pet created.' })
  @ApiResponse({ status: 400, description: 'Validation failed.' })
  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() createPetDto: CreatePetDto) {
    return this.petsService.create(user.sub, createPetDto);
  }

  @ApiOperation({ summary: "Get statistics for the current user's pets" })
  @ApiResponse({
    status: 200,
    description: 'Aggregate pet statistics for the caller.',
  })
  @Get('statistics')
  getStatistics(@CurrentUser() user: JwtPayload) {
    return this.petsService.getStatistics(user.sub);
  }

  @ApiOperation({ summary: 'Get a single pet owned by the current user' })
  @ApiParam({ name: 'id', description: 'Pet ID' })
  @ApiResponse({ status: 200, description: 'The pet.' })
  @ApiResponse({
    status: 404,
    description: 'Pet not found or not owned by the caller.',
  })
  @Get(':id')
  findOne(
    @CurrentUser() user: JwtPayload,

    @Param('id')
    petId: string,
  ) {
    return this.petsService.findOne(user.sub, petId);
  }

  @ApiOperation({ summary: 'Update a pet owned by the current user' })
  @ApiParam({ name: 'id', description: 'Pet ID' })
  @ApiResponse({ status: 200, description: 'The updated pet.' })
  @ApiResponse({
    status: 404,
    description: 'Pet not found or not owned by the caller.',
  })
  @Patch(':id')
  update(
    @CurrentUser() user: JwtPayload,

    @Param('id')
    petId: string,

    @Body()
    updatePetDto: UpdatePetDto,
  ) {
    return this.petsService.update(user.sub, petId, updatePetDto);
  }

  @ApiOperation({ summary: 'Delete a pet owned by the current user' })
  @ApiParam({ name: 'id', description: 'Pet ID' })
  @ApiResponse({ status: 200, description: 'Pet deleted.' })
  @ApiResponse({
    status: 404,
    description: 'Pet not found or not owned by the caller.',
  })
  @Delete(':id')
  remove(
    @CurrentUser() user: JwtPayload,

    @Param('id')
    petId: string,
  ) {
    return this.petsService.remove(user.sub, petId);
  }

  @ApiOperation({ summary: 'Mark a pet as lost' })
  @ApiParam({ name: 'id', description: 'Pet ID' })
  @ApiResponse({ status: 200, description: 'Pet marked as lost.' })
  @ApiResponse({
    status: 404,
    description: 'Pet not found or not owned by the caller.',
  })
  @Patch(':id/report-lost')
  reportLost(
    @CurrentUser() user: JwtPayload,

    @Param('id')
    petId: string,

    @Body()
    dto: ReportLostDto,
  ) {
    return this.petsService.reportLost(user.sub, petId, dto);
  }

  @ApiOperation({ summary: 'Mark a pet as found/recovered' })
  @ApiParam({ name: 'id', description: 'Pet ID' })
  @ApiResponse({ status: 200, description: 'Pet marked as found.' })
  @ApiResponse({
    status: 404,
    description: 'Pet not found or not owned by the caller.',
  })
  @Patch(':id/report-found')
  reportFound(
    @CurrentUser() user: JwtPayload,

    @Param('id')
    petId: string,
  ) {
    return this.petsService.reportFound(user.sub, petId);
  }
}
