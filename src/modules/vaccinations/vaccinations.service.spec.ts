import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { VaccinationsService } from './vaccinations.service';
import { Vaccination } from './schemas/vaccination.schema';
import { PetsService } from '../pets/pets.service';

describe('VaccinationsService', () => {
  let service: VaccinationsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VaccinationsService,
        { provide: getModelToken(Vaccination.name), useValue: {} },
        { provide: PetsService, useValue: {} },
      ],
    }).compile();

    service = module.get<VaccinationsService>(VaccinationsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
