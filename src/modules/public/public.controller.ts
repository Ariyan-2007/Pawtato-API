import { Controller, Get, Param } from '@nestjs/common';

import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { PublicService } from './public.service';

@ApiTags('Public')
@Controller('public')
export class PublicController {
  constructor(private readonly publicService: PublicService) {}

  @ApiOperation({
    summary: "Get a pet's public profile by its public ID",
    description:
      'No authentication required. This is the page a QR-code scan resolves to. ' +
      'Never returns owner-private information (password, internal IDs, unshared contact details).',
  })
  @ApiResponse({ status: 200, description: 'Public pet profile.' })
  @ApiResponse({ status: 404, description: 'No pet found for this public ID.' })
  @Throttle({ public: { limit: 20, ttl: 60_000 } })
  @Get('pets/:publicId')
  getPetProfile(
    @Param('publicId')
    publicId: string,
  ) {
    return this.publicService.getPetProfile(publicId);
  }

  @ApiOperation({
    summary: 'List pets currently reported lost',
    description: 'No authentication required.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of lost pets with public-safe fields only.',
  })
  @Throttle({ public: { limit: 20, ttl: 60_000 } })
  @Get('lost-pets')
  getLostPets() {
    return this.publicService.getLostPets();
  }
}
