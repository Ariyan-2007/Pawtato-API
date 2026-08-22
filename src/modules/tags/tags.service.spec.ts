import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { TagsService } from './tags.service';
import { Tag } from './schemas/tag.schema';
import { PetsService } from '../pets/pets.service';
import { QrService } from '../qr/qr.service';

describe('TagsService', () => {
  let service: TagsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TagsService,
        { provide: getModelToken(Tag.name), useValue: {} },
        { provide: PetsService, useValue: {} },
        { provide: QrService, useValue: {} },
      ],
    }).compile();

    service = module.get<TagsService>(TagsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
