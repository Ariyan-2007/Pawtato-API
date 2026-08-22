import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import {
  MedicalRecord,
  MedicalRecordDocument,
} from './schemas/medical-record.schema';

import { CreateMedicalRecordDto } from './dto/create-medical-record.dto';

import { PetsService } from '../pets/pets.service';

@Injectable()
export class MedicalService {
  constructor(
    @InjectModel(MedicalRecord.name)
    private readonly medicalModel: Model<MedicalRecordDocument>,

    private readonly petsService: PetsService,
  ) {}

  async create(ownerId: string, petId: string, dto: CreateMedicalRecordDto) {
    await this.petsService.findOwnedPet(ownerId, petId);

    return this.medicalModel.create({
      pet: petId,
      ...dto,
    });
  }

  async findAll(ownerId: string, petId: string) {
    await this.petsService.findOwnedPet(ownerId, petId);

    return this.medicalModel
      .find({
        pet: petId,
      })
      .sort({
        visitDate: -1,
        createdAt: -1,
      });
  }

  async count(): Promise<number> {
    return this.medicalModel.countDocuments();
  }
}
