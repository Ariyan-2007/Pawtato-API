import {
  Controller,
  Get,
  Param,
} from '@nestjs/common';

import {
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { PublicService } from './public.service';

@ApiTags('Public')
@Controller('public')
export class PublicController {
  constructor(
    private readonly publicService: PublicService,
  ) {}

  @ApiOperation({
    summary: 'Get public pet profile',
  })
  @Get('pets/:publicId')
  getPetProfile(
    @Param('publicId')
    publicId: string,
  ) {
    return this.publicService.getPetProfile(
      publicId,
    );
  }
  @Get('lost-pets')
  getLostPets() {
  return this.publicService.getLostPets();
}
}