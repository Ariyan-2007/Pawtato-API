import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { ScanEvent, ScanEventDocument } from './schemas/scan-event.schema';
import { PetsService } from '../pets/pets.service';

@Injectable()
export class ScansService {
  constructor(
    @InjectModel(ScanEvent.name)
    private readonly scanEventModel: Model<ScanEventDocument>,

    private readonly petsService: PetsService,
  ) {}

  async record(
    tagId: Types.ObjectId,
    petId: Types.ObjectId | null,
    userAgent?: string,
  ) {
    return this.scanEventModel.create({
      tag: tagId,
      pet: petId,
      userAgent,
    });
  }

  async findForOwnedPet(ownerId: string, petId: string) {
    await this.petsService.findOwnedPet(ownerId, petId);

    return this.scanEventModel.find({ pet: petId }).sort({ createdAt: -1 });
  }
}
