import { BadRequestException, HttpException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Types } from 'mongoose';

import { FoundReportsService } from './found-reports.service';
import { FoundReport } from './schemas/found-report.schema';
import { TagsService } from '../tags/tags.service';
import { PetsService } from '../pets/pets.service';
import { TagStatus } from '../../common/enums/tag-status.enum';

describe('FoundReportsService', () => {
  let service: FoundReportsService;
  let foundReportModel: {
    create: jest.Mock;
    exists: jest.Mock;
    countDocuments: jest.Mock;
    find: jest.Mock;
  };
  let tagsService: { findByPublicCode: jest.Mock; findOwnedById: jest.Mock };
  let petsService: { findOwnedPet: jest.Mock; findWithOwner: jest.Mock };

  const tagId = new Types.ObjectId();
  const petId = new Types.ObjectId();

  const dto = {
    message: 'Found near Road 27.',
    deviceFingerprint: 'device-fingerprint-abc123',
  };

  beforeEach(async () => {
    foundReportModel = {
      create: jest.fn().mockResolvedValue({ _id: new Types.ObjectId() }),
      exists: jest.fn().mockResolvedValue(null),
      countDocuments: jest.fn().mockResolvedValue(0),
      find: jest.fn(),
    };
    tagsService = {
      findByPublicCode: jest.fn().mockResolvedValue({
        _id: tagId,
        status: TagStatus.ASSIGNED,
        assignedPetId: petId,
      }),
      findOwnedById: jest.fn().mockResolvedValue({ _id: tagId }),
    };
    petsService = {
      findOwnedPet: jest.fn(),
      findWithOwner: jest.fn().mockResolvedValue(null),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FoundReportsService,
        {
          provide: getModelToken(FoundReport.name),
          useValue: foundReportModel,
        },
        { provide: TagsService, useValue: tagsService },
        { provide: PetsService, useValue: petsService },
        { provide: EventEmitter2, useValue: {} },
      ],
    }).compile();

    service = module.get<FoundReportsService>(FoundReportsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('rejects a tag that is not currently linked to a pet', async () => {
      tagsService.findByPublicCode.mockResolvedValue({
        _id: tagId,
        status: TagStatus.AVAILABLE,
        assignedPetId: null,
      });

      await expect(service.create('CODE1', dto)).rejects.toThrow(
        BadRequestException,
      );
      expect(foundReportModel.create).not.toHaveBeenCalled();
    });

    it('creates the report and stores the device fingerprint', async () => {
      await service.create('CODE1', dto);

      expect(foundReportModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tag: tagId,
          pet: petId,
          deviceFingerprint: dto.deviceFingerprint,
        }),
      );
    });

    it('rejects a repeat submission for the same tag within the cooldown', async () => {
      foundReportModel.exists.mockResolvedValue({ _id: new Types.ObjectId() });

      await expect(service.create('CODE1', dto)).rejects.toThrow(HttpException);
      expect(foundReportModel.create).not.toHaveBeenCalled();
    });

    it('rejects once the per-fingerprint hourly cap is hit', async () => {
      foundReportModel.countDocuments.mockResolvedValue(5);

      await expect(service.create('CODE1', dto)).rejects.toThrow(
        'Too many reports submitted from this device recently — please try again later.',
      );
      expect(foundReportModel.create).not.toHaveBeenCalled();
    });

    it('allows a fresh device under the cap to submit', async () => {
      foundReportModel.countDocuments.mockResolvedValue(4);

      await expect(service.create('CODE1', dto)).resolves.toBeDefined();
      expect(foundReportModel.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('findForOwnedTag', () => {
    it("checks tag ownership and returns that tag's reports, newest first", async () => {
      const sort = jest.fn().mockResolvedValue([]);
      foundReportModel.find.mockReturnValue({ sort });
      const ownerId = new Types.ObjectId().toString();

      await service.findForOwnedTag(ownerId, 'tag-id', false);

      expect(tagsService.findOwnedById).toHaveBeenCalledWith(
        ownerId,
        'tag-id',
        false,
      );
      expect(foundReportModel.find).toHaveBeenCalledWith({ tag: tagId });
      expect(sort).toHaveBeenCalledWith({ createdAt: -1 });
    });
  });
});
