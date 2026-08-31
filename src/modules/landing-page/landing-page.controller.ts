import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { LandingPageService } from './landing-page.service';

@ApiTags('Landing Page')
@Controller('landing-page')
export class LandingPageController {
  constructor(private readonly landingPageService: LandingPageService) {}

  @ApiOperation({
    summary: 'Get the public landing-page configuration',
    description:
      'No authentication required. Returns only enabled sections, sorted by their display ' +
      "order. The frontend should render exactly what's returned, in the order it's returned, " +
      'with no section-specific logic of its own — a section absent here should not be rendered.',
  })
  @ApiResponse({
    status: 200,
    description: 'Enabled landing-page sections, sorted by order.',
  })
  @Get()
  async getPublicLandingPage() {
    const sections = await this.landingPageService.getPublicSections();

    return { sections };
  }
}
