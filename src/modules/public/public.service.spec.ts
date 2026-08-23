import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';

import { PublicService } from './public.service';
import { Pet } from '../pets/schemas/pet.schema';
import { Tag } from '../tags/schemas/tag.schema';
import { ScansService } from '../scans/scans.service';
import { FoundReportsService } from '../found-reports/found-reports.service';
import { TagStatus } from '../../common/enums/tag-status.enum';

describe('PublicService', () => {
  let service: PublicService;
  let petModel: { findByIdAndUpdate: jest.Mock };
  let tagModel: { findOne: jest.Mock };
  let scansService: { record: jest.Mock };

  const petId = new Types.ObjectId();

  beforeEach(async () => {
    petModel = { findByIdAndUpdate: jest.fn() };
    tagModel = { findOne: jest.fn() };
    scansService = { record: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PublicService,
        { provide: getModelToken(Pet.name), useValue: petModel },
        { provide: getModelToken(Tag.name), useValue: tagModel },
        { provide: ScansService, useValue: scansService },
        { provide: FoundReportsService, useValue: {} },
      ],
    }).compile();

    service = module.get<PublicService>(PublicService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getPetProfile', () => {
    it('returns the not-linked message for a code that was never issued', async () => {
      tagModel.findOne.mockResolvedValue(null);

      const result = await service.getPetProfile('UNKNOWN');

      expect(result).toEqual({
        tagStatus: TagStatus.AVAILABLE,
        message: 'This QR is not linked to a pet.',
      });
    });

    it('includes notableTrait, birthDate, weight, and a plain petStatus label for a linked pet', async () => {
      tagModel.findOne.mockResolvedValue({
        _id: new Types.ObjectId(),
        publicCode: 'CODE1',
        status: TagStatus.ASSIGNED,
        assignedPetId: petId,
      });
      petModel.findByIdAndUpdate.mockResolvedValue({
        name: 'Milo',
        species: 'Cat',
        breed: 'Persian',
        gender: 'Male',
        color: 'White',
        birthDate: new Date('2022-05-01'),
        weight: 4.2,
        notableTrait: 'Friendly but startles easily.',
        isLost: true,
        profileImage: '/uploads/pets/milo.png',
        lastSeenLocation: 'Dhanmondi',
        lostDate: new Date('2026-08-01'),
        lostDescription: 'Wearing a red collar.',
        reward: 50,
        emergencyContact: '+8801XXXXXXXXX',
      });

      const result = await service.getPetProfile('CODE1');

      expect(result).toEqual(
        expect.objectContaining({
          petStatus: 'MISSING',
          notableTrait: 'Friendly but startles easily.',
          weight: 4.2,
          birthDate: new Date('2022-05-01'),
        }),
      );
    });

    it('reports petStatus SAFE for a pet that is not lost', async () => {
      tagModel.findOne.mockResolvedValue({
        _id: new Types.ObjectId(),
        publicCode: 'CODE1',
        status: TagStatus.ASSIGNED,
        assignedPetId: petId,
      });
      petModel.findByIdAndUpdate.mockResolvedValue({
        name: 'Milo',
        species: 'Cat',
        isLost: false,
      });

      const result = await service.getPetProfile('CODE1');

      expect(result).toEqual(expect.objectContaining({ petStatus: 'SAFE' }));
    });
  });
});
