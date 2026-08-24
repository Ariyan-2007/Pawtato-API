import { Test, TestingModule } from '@nestjs/testing';
import { HealthService } from './health.service';

describe('HealthService', () => {
  let service: HealthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [HealthService],
    }).compile();

    service = module.get<HealthService>(HealthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getHealth', () => {
    it('reports success with a fresh timestamp', () => {
      const result = service.getHealth();

      expect(result.success).toBe(true);
      expect(result.message).toBe('Pawtato API is running');
      expect(new Date(result.timestamp).getTime()).not.toBeNaN();
    });
  });
});
