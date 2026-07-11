import {
  Body,
  Controller,
  Post,
  UseGuards,
} from '@nestjs/common';

import {
  ApiBearerAuth,
  ApiTags,
} from '@nestjs/swagger';

import { PetsService } from './pets.service';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { CurrentUser } from '../../common/decorators/current-user.decorator';

import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

import { CreatePetDto } from './dto/create-pet.dto';

@ApiTags('Pets')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('pets')
export class PetsController {
  constructor(
    private readonly petsService: PetsService,
  ) {}

  @Post()
  create(
    @CurrentUser() user: JwtPayload,
    @Body() createPetDto: CreatePetDto,
  ) {
    return this.petsService.create(
      user.sub,
      createPetDto,
    );
  }
}