import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';

import { Model, Types } from 'mongoose';

import { Pet, PetDocument } from './schemas/pet.schema';

import { CreatePetDto } from './dto/create-pet.dto';

@Injectable()
export class PetsService {
  constructor(
    @InjectModel(Pet.name)
    private readonly petModel: Model<PetDocument>,
  ) {}

  async create(
    ownerId: string,
    createPetDto: CreatePetDto,
  ) {
    const pet = await this.petModel.create({
      ...createPetDto,
      owner: new Types.ObjectId(ownerId),
    });

    return pet;
  }
}