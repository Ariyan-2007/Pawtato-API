import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { FoundReportsService } from './found-reports.service';
import { FoundReport } from './schemas/found-report.schema';
import { TagsService } from '../tags/tags.service';
import { PetsService } from '../pets/pets.service';
import { NotificationsService } from '../notifications/notifications.service';

describe('FoundReportsService', () => {
  let service: FoundReportsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FoundReportsService,
        { provide: getModelToken(FoundReport.name), useValue: {} },
        { provide: TagsService, useValue: {} },
        { provide: PetsService, useValue: {} },
        { provide: NotificationsService, useValue: {} },
      ],
    }).compile();

    service = module.get<FoundReportsService>(FoundReportsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
