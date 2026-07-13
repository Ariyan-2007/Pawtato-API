import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Pet, PetDocument } from '../pets/schemas/pet.schema';

@Injectable()
export class PublicService {
  constructor(
    @InjectModel(Pet.name)
    private readonly petModel: Model<PetDocument>,
  ) {}

  async getPetProfile(
    publicId: string,
  ) {
    const pet = await this.petModel.findOneAndUpdate(
    {
    publicId,
    },
    {
    $inc: {
      scanCount: 1,
     },
    lastScannedAt: new Date(),
   },
    {
    new: true,
    },
  );

    if (!pet) {
      throw new NotFoundException(
        'Pet not found',
      );
    }

    return {
      name: pet.name,
      species: pet.species,
      breed: pet.breed,
      gender: pet.gender,
      color: pet.color,
      isLost: pet.isLost,
      profileImage: pet.profileImage,
      lastSeenLocation: pet.lastSeenLocation,
      lostDate: pet.lostDate,
      lostDescription: pet.lostDescription,
      reward: pet.reward,
      emergencyContact: pet.emergencyContact,
    };
  }
}