import { Test, TestingModule } from '@nestjs/testing';
import { VaccinationsService } from './vaccinations.service';

describe('VaccinationsService', () => {
  let service: VaccinationsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [VaccinationsService],
    }).compile();

    service = module.get<VaccinationsService>(VaccinationsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
