import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

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

  // No ownership check — used by DatingService to build a dating profile's
  // medicalSummary, which is only ever read when the pet's own owner has
  // already opted into `shareHealthSummary`. Authorization lives at that
  // call site, not here (mirrors PetsService.findByIdAdmin's "Admin"-style
  // unrestricted read, just not admin-only in this case).
  async findAllByPet(petId: string) {
    return this.medicalModel.find({ pet: petId });
  }

  async count(): Promise<number> {
    return this.medicalModel.countDocuments();
  }

  // Cascade delete — no files to clean up here (medical records have no
  // stored attachments of their own), just the documents. Called from
  // AdminService when a pet (or its owner) is deleted.
  async deleteAllForPets(petIds: string[]) {
    if (petIds.length === 0) {
      return { deletedCount: 0 };
    }

    const result = await this.medicalModel.deleteMany({
      pet: { $in: petIds.map((id) => new Types.ObjectId(id)) },
    });

    return { deletedCount: result.deletedCount };
  }
}
