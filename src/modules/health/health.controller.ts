import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { HealthService } from './health.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @ApiOperation({ summary: 'Check API liveness' })
  @ApiResponse({ status: 200, description: 'Service is up.' })
  @Get()
  checkHealth() {
    return this.healthService.getHealth();
  }
}
