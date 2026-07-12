import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Pet, PetDocument } from './schemas/pet.schema';
import { CreatePetDto } from './dto/create-pet.dto';
import { NotFoundException } from '@nestjs/common';
import { UpdatePetDto } from './dto/update-pet.dto';
import { nanoid } from 'nanoid';

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
      publicId: nanoid(10),
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
    async update(
    ownerId: string,
    petId: string,
    updatePetDto: UpdatePetDto,
      ) {
     const pet = await this.petModel.findOneAndUpdate(
     {
      _id: petId,
      owner: new Types.ObjectId(ownerId),
     },
     updatePetDto,
     {
      new: true,
      },
    );

     if (!pet) {
     throw new NotFoundException('Pet not found');}

      return pet;
      }
    async remove(
     ownerId: string,
     petId: string,
     ) {
     const pet = await this.petModel.findOneAndDelete({
     _id: petId,
     owner: new Types.ObjectId(ownerId),
  });

  if (!pet) {
    throw new NotFoundException('Pet not found');
  }

  return {
    message: 'Pet deleted successfully',
  };
}

}