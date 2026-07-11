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
  ApiTags,
} from '@nestjs/swagger';

import { PetsService } from './pets.service';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { CurrentUser } from '../../common/decorators/current-user.decorator';

import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

import { CreatePetDto } from './dto/create-pet.dto';
import { UpdatePetDto } from './dto/update-pet.dto';

@ApiTags('Pets')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('pets')
export class PetsController {
  constructor(
    private readonly petsService: PetsService,
  ) {}

  @Get()
  findAll(
  @CurrentUser() user: JwtPayload,
   ) {
  return this.petsService.findAll(user.sub);
  }

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
  @Get(':id')
 findOne(
  @CurrentUser() user: JwtPayload,

  @Param('id')
  petId: string,
  ) {
  return this.petsService.findOne(
    user.sub,
    petId,
  );

 }
 @Patch(':id')
 update(
  @CurrentUser() user: JwtPayload,

  @Param('id')
  petId: string,

  @Body()
  updatePetDto: UpdatePetDto,
 ) {
  return this.petsService.update(
    user.sub,
    petId,
    updatePetDto,
  );
 }
 @Delete(':id')
remove(
  @CurrentUser() user: JwtPayload,

  @Param('id')
  petId: string,
) {
  return this.petsService.remove(
    user.sub,
    petId,
  );
}
}