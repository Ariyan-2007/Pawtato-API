import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { Vaccination, VaccinationDocument } from './schemas/vaccination.schema';

import { CreateVaccinationDto } from './dto/create-vaccination.dto';

import { PetsService } from '../pets/pets.service';

@Injectable()
export class VaccinationsService {
  constructor(
    @InjectModel(Vaccination.name)
    private readonly vaccinationModel: Model<VaccinationDocument>,

    private readonly petsService: PetsService,
  ) {}

  async create(ownerId: string, petId: string, dto: CreateVaccinationDto) {
    await this.petsService.findOwnedPet(ownerId, petId);

    return this.vaccinationModel.create({
      pet: petId,
      ...dto,
    });
  }

  async findAll(ownerId: string, petId: string) {
    await this.petsService.findOwnedPet(ownerId, petId);

    return this.vaccinationModel
      .find({
        pet: petId,
      })
      .sort({
        nextDueDate: 1,
      });
  }

  async count(): Promise<number> {
    return this.vaccinationModel.countDocuments();
  }

  // Cascade delete — no files to clean up here (vaccination records have no
  // stored attachments of their own), just the documents. Called from
  // AdminService when a pet (or its owner) is deleted.
  async deleteAllForPets(petIds: string[]) {
    if (petIds.length === 0) {
      return { deletedCount: 0 };
    }

    const result = await this.vaccinationModel.deleteMany({
      pet: { $in: petIds.map((id) => new Types.ObjectId(id)) },
    });

    return { deletedCount: result.deletedCount };
  }
}
