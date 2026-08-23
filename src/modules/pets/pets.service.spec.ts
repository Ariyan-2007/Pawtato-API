import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PetsService } from './pets.service';
import { Pet } from './schemas/pet.schema';

describe('PetsService', () => {
  let service: PetsService;
  let petModel: { findOneAndUpdate: jest.Mock };

  beforeEach(async () => {
    petModel = {
      findOneAndUpdate: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PetsService,
        { provide: getModelToken(Pet.name), useValue: petModel },
        { provide: EventEmitter2, useValue: {} },
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
      petModel.findOneAndUpdate.mockResolvedValue({
        profileImage: '/uploads/pets/photo.png',
      });

      await service.updatePhoto(ownerId, petId, '/uploads/pets/photo.png');

      expect(petModel.findOneAndUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ _id: petId }),
        { profileImage: '/uploads/pets/photo.png' },
        { new: true },
      );
    });

    it('throws NotFoundException when the pet is not owned by the caller', async () => {
      petModel.findOneAndUpdate.mockResolvedValue(null);

      await expect(
        service.updatePhoto(ownerId, petId, '/uploads/pets/photo.png'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
