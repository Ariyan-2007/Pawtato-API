import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PetsService } from './pets.service';
import { Pet } from './schemas/pet.schema';
import { STORAGE_PROVIDER } from '../storage/storage.constants';

describe('PetsService', () => {
  let service: PetsService;
  let petModel: { findOneAndUpdate: jest.Mock; findOne: jest.Mock };
  let storageProvider: { deleteByUrl: jest.Mock };

  beforeEach(async () => {
    petModel = {
      findOneAndUpdate: jest.fn(),
      findOne: jest.fn(),
    };
    storageProvider = {
      deleteByUrl: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PetsService,
        { provide: getModelToken(Pet.name), useValue: petModel },
        { provide: EventEmitter2, useValue: {} },
        { provide: STORAGE_PROVIDER, useValue: storageProvider },
      ],
    }).compile();

    service = module.get<PetsService>(PetsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('updatePhoto', () => {
    const ownerId = '507f1f77bcf86cd799439011';
    const petId = '507f191e810c19729de860ea';

    it('scopes the update to the pet owned by the caller', async () => {
      petModel.findOne.mockReturnValue({
        select: jest
          .fn()
          .mockResolvedValue({ profileImage: '/uploads/pets/old.png' }),
      });
      petModel.findOneAndUpdate.mockResolvedValue({
        profileImage: '/uploads/pets/photo.png',
      });

      await service.updatePhoto(ownerId, petId, '/uploads/pets/photo.png');

      expect(petModel.findOneAndUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ _id: petId }),
        { profileImage: '/uploads/pets/photo.png' },
        { new: true },
      );
      expect(storageProvider.deleteByUrl).toHaveBeenCalledWith(
        '/uploads/pets/old.png',
      );
    });

    it('throws NotFoundException when the pet is not owned by the caller', async () => {
      petModel.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.updatePhoto(ownerId, petId, '/uploads/pets/photo.png'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
