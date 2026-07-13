import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';

import {
  ApiBearerAuth,
  ApiTags,
} from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

import { VaccinationsService } from './vaccinations.service';
import { CreateVaccinationDto } from './dto/create-vaccination.dto';

@ApiTags('Vaccinations')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('pets/:petId/vaccinations')
export class VaccinationsController {
  constructor(
    private readonly vaccinationsService: VaccinationsService,
  ) {}

  @Post()
  create(
    @CurrentUser() user: JwtPayload,

    @Param('petId')
    petId: string,

    @Body()
    dto: CreateVaccinationDto,
  ) {
    return this.vaccinationsService.create(
      user.sub,
      petId,
      dto,
    );
  }

  @Get()
  findAll(
    @CurrentUser() user: JwtPayload,

    @Param('petId')
    petId: string,
  ) {
    return this.vaccinationsService.findAll(
      user.sub,
      petId,
    );
  }
}