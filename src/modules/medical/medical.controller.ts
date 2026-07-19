import {
  Body,
  Controller,
  Param,
  Post,
  Get,
  UseGuards,
} from '@nestjs/common';

import {
  ApiBearerAuth,
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
  constructor(
    private readonly medicalService: MedicalService,
  ) {}

  @Post()
  create(
    @CurrentUser() user: JwtPayload,

    @Param('petId')
    petId: string,

    @Body()
    dto: CreateMedicalRecordDto,
  ) {
    return this.medicalService.create(
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
  return this.medicalService.findAll(
    user.sub,
    petId,
  );
} 
}