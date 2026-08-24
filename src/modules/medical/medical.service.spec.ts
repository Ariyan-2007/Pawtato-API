import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';

import { MedicalService } from './medical.service';
import { MedicalRecord } from './schemas/medical-record.schema';
import { PetsService } from '../pets/pets.service';

describe('MedicalService', () => {
  let service: MedicalService;
  let medicalModel: {
    create: jest.Mock;
    find: jest.Mock;
    deleteMany: jest.Mock;
  };
  let petsService: { findOwnedPet: jest.Mock };

  const ownerId = new Types.ObjectId().toString();
  const petId = new Types.ObjectId().toString();

  beforeEach(async () => {
    medicalModel = {
      create: jest.fn(),
      find: jest.fn(),
      deleteMany: jest.fn().mockResolvedValue({ deletedCount: 0 }),
    };
    petsService = { findOwnedPet: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MedicalService,
        { provide: getModelToken(MedicalRecord.name), useValue: medicalModel },
        { provide: PetsService, useValue: petsService },
      ],
    }).compile();

    service = module.get<MedicalService>(MedicalService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('checks ownership before creating a record, scoped to the pet', async () => {
      petsService.findOwnedPet.mockResolvedValue({ _id: petId });
      medicalModel.create.mockResolvedValue({ pet: petId });

      const dto = { title: 'Annual checkup', visitDate: new Date() };
      await service.create(ownerId, petId, dto);

      expect(petsService.findOwnedPet).toHaveBeenCalledWith(ownerId, petId);
      expect(medicalModel.create).toHaveBeenCalledWith({
        pet: petId,
        ...dto,
      });
    });

    it('propagates the NotFoundException when the caller does not own the pet', async () => {
      const notOwned = new Error('Pet not found');
      petsService.findOwnedPet.mockRejectedValue(notOwned);

      await expect(
        service.create('someone-else', petId, { title: 'x' }),
      ).rejects.toThrow(notOwned);
      expect(medicalModel.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('checks ownership before listing records for the pet', async () => {
      petsService.findOwnedPet.mockResolvedValue({ _id: petId });
      const sort = jest.fn().mockResolvedValue([]);
      medicalModel.find.mockReturnValue({ sort });

      await service.findAll(ownerId, petId);

      expect(petsService.findOwnedPet).toHaveBeenCalledWith(ownerId, petId);
      expect(medicalModel.find).toHaveBeenCalledWith({ pet: petId });
    });

    it('propagates the NotFoundException when the caller does not own the pet', async () => {
      const notOwned = new Error('Pet not found');
      petsService.findOwnedPet.mockRejectedValue(notOwned);

      await expect(service.findAll('someone-else', petId)).rejects.toThrow(
        notOwned,
      );
      expect(medicalModel.find).not.toHaveBeenCalled();
    });
  });

  describe('deleteAllForPets', () => {
    it('deletes every medical record for the given pets', async () => {
      const otherPetId = new Types.ObjectId().toString();
      medicalModel.deleteMany.mockResolvedValue({ deletedCount: 3 });

      const result = await service.deleteAllForPets([petId, otherPetId]);

      expect(medicalModel.deleteMany).toHaveBeenCalledWith({
        pet: {
          $in: [new Types.ObjectId(petId), new Types.ObjectId(otherPetId)],
        },
      });
      expect(result).toEqual({ deletedCount: 3 });
    });

    it('skips the query entirely for an empty pet list', async () => {
      const result = await service.deleteAllForPets([]);

      expect(medicalModel.deleteMany).not.toHaveBeenCalled();
      expect(result).toEqual({ deletedCount: 0 });
    });
  });
});
