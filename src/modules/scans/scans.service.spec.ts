import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ScansService } from './scans.service';
import { ScanEvent } from './schemas/scan-event.schema';
import { PetsService } from '../pets/pets.service';

describe('ScansService', () => {
  let service: ScansService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScansService,
        { provide: getModelToken(ScanEvent.name), useValue: {} },
        { provide: PetsService, useValue: {} },
      ],
    }).compile();

    service = module.get<ScansService>(ScansService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
