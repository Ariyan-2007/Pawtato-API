import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { MedicalService } from './medical.service';
import { MedicalRecord } from './schemas/medical-record.schema';
import { PetsService } from '../pets/pets.service';

describe('MedicalService', () => {
  let service: MedicalService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MedicalService,
        { provide: getModelToken(MedicalRecord.name), useValue: {} },
        { provide: PetsService, useValue: {} },
      ],
    }).compile();

    service = module.get<MedicalService>(MedicalService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
