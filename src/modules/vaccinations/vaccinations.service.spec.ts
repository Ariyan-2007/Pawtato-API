import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';

import { VaccinationsService } from './vaccinations.service';
import { Vaccination } from './schemas/vaccination.schema';
import { PetsService } from '../pets/pets.service';

describe('VaccinationsService', () => {
  let service: VaccinationsService;
  let vaccinationModel: { create: jest.Mock; find: jest.Mock };
  let petsService: { findOwnedPet: jest.Mock };

  const ownerId = new Types.ObjectId().toString();
  const petId = new Types.ObjectId().toString();

  const dto = {
    vaccineName: 'Rabies',
    administeredDate: new Date('2026-01-15'),
    nextDueDate: new Date('2027-01-15'),
  };

  beforeEach(async () => {
    vaccinationModel = { create: jest.fn(), find: jest.fn() };
    petsService = { findOwnedPet: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VaccinationsService,
        {
          provide: getModelToken(Vaccination.name),
          useValue: vaccinationModel,
        },
        { provide: PetsService, useValue: petsService },
      ],
    }).compile();

    service = module.get<VaccinationsService>(VaccinationsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('checks ownership before creating a record, scoped to the pet', async () => {
      petsService.findOwnedPet.mockResolvedValue({ _id: petId });
      vaccinationModel.create.mockResolvedValue({ pet: petId });

      await service.create(ownerId, petId, dto);

      expect(petsService.findOwnedPet).toHaveBeenCalledWith(ownerId, petId);
      expect(vaccinationModel.create).toHaveBeenCalledWith({
        pet: petId,
        ...dto,
      });
    });

    it('propagates the NotFoundException when the caller does not own the pet', async () => {
      const notOwned = new Error('Pet not found');
      petsService.findOwnedPet.mockRejectedValue(notOwned);

      await expect(service.create('someone-else', petId, dto)).rejects.toThrow(
        notOwned,
      );
      expect(vaccinationModel.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('checks ownership before listing records for the pet, sorted by next due date', async () => {
      petsService.findOwnedPet.mockResolvedValue({ _id: petId });
      const sort = jest.fn().mockResolvedValue([]);
      vaccinationModel.find.mockReturnValue({ sort });

      await service.findAll(ownerId, petId);

      expect(petsService.findOwnedPet).toHaveBeenCalledWith(ownerId, petId);
      expect(vaccinationModel.find).toHaveBeenCalledWith({ pet: petId });
      expect(sort).toHaveBeenCalledWith({ nextDueDate: 1 });
    });

    it('propagates the NotFoundException when the caller does not own the pet', async () => {
      const notOwned = new Error('Pet not found');
      petsService.findOwnedPet.mockRejectedValue(notOwned);

      await expect(service.findAll('someone-else', petId)).rejects.toThrow(
        notOwned,
      );
      expect(vaccinationModel.find).not.toHaveBeenCalled();
    });
  });
});
