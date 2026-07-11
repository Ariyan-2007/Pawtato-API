import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Pet, PetDocument } from './schemas/pet.schema';
import { CreatePetDto } from './dto/create-pet.dto';
import { NotFoundException } from '@nestjs/common';

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
  async findAll(ownerId: string) {
  return this.petModel
    .find({
      owner: new Types.ObjectId(ownerId),
      })
    .sort({
      createdAt: -1,
     });
     }

   async findOne(
     ownerId: string,
     petId: string,
     ) {
   const pet = await this.petModel.findOne({
     _id: petId,
     owner: new Types.ObjectId(ownerId),
     });

    if (!pet) {
    throw new NotFoundException(
      'Pet not found',
     );
  }

  return pet;
}
}