import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { PublicService } from './public.service';
import { Pet } from '../pets/schemas/pet.schema';
import { Tag } from '../tags/schemas/tag.schema';
import { ScansService } from '../scans/scans.service';
import { FoundReportsService } from '../found-reports/found-reports.service';

describe('PublicService', () => {
  let service: PublicService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PublicService,
        { provide: getModelToken(Pet.name), useValue: {} },
        { provide: getModelToken(Tag.name), useValue: {} },
        { provide: ScansService, useValue: {} },
        { provide: FoundReportsService, useValue: {} },
      ],
    }).compile();

    service = module.get<PublicService>(PublicService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
