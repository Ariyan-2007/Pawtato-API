import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { FoundReportsService } from './found-reports.service';
import { FoundReport } from './schemas/found-report.schema';
import { TagsService } from '../tags/tags.service';
import { PetsService } from '../pets/pets.service';

describe('FoundReportsService', () => {
  let service: FoundReportsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FoundReportsService,
        { provide: getModelToken(FoundReport.name), useValue: {} },
        { provide: TagsService, useValue: {} },
        { provide: PetsService, useValue: {} },
        { provide: EventEmitter2, useValue: {} },
      ],
    }).compile();

    service = module.get<FoundReportsService>(FoundReportsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
