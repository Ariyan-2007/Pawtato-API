import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

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
}
