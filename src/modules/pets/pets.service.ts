import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { nanoid } from 'nanoid';
import { Pet, PetDocument } from './schemas/pet.schema';
import { CreatePetDto } from './dto/create-pet.dto';
import { UpdatePetDto } from './dto/update-pet.dto';
import { QrService } from '../qr/qr.service';
import { ReportLostDto } from './dto/report-lost.dto';

@Injectable()
export class PetsService {
  constructor(
    @InjectModel(Pet.name)
    private readonly petModel: Model<PetDocument>,

    private readonly qrService: QrService,
  ) {}

  async create(
    ownerId: string,
    createPetDto: CreatePetDto,
  ) {
    const publicId = nanoid(10);

    const qrCode = await this.qrService.generate(publicId);

    const pet = await this.petModel.create({
      ...createPetDto,
      owner: new Types.ObjectId(ownerId),
      publicId,
      qrCode,
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
      throw new NotFoundException('Pet not found');
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
      throw new NotFoundException('Pet not found');
    }

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

    async reportLost(
    ownerId: string,
    petId: string,
    dto: ReportLostDto,
   ) {
    const pet = await this.petModel.findOneAndUpdate(
      {
      _id: petId,
      owner: new Types.ObjectId(ownerId),
     },
     {
      ...dto,
      isLost: true,
      lostDate: new Date(),
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

    return pet;
  }

   async reportFound(
   ownerId: string,
   petId: string,
   ) {
   const pet = await this.petModel.findOneAndUpdate(
    {
      _id: petId,
      owner: new Types.ObjectId(ownerId),
    },
    {
      isLost: false,
      lostDate: undefined,
      lastSeenLocation: undefined,
      lostDescription: undefined,
      reward: undefined,
    },
    {
      new: true,
    },
  );

  if (!pet) {
    throw new NotFoundException('Pet not found');
  }

  return pet;
  }

  async getStatistics(ownerId: string) {
  const owner = new Types.ObjectId(ownerId);

  const [
    totalPets,
    lostPets,
    foundPets,
  ] = await Promise.all([
    this.petModel.countDocuments({ owner }),
    this.petModel.countDocuments({
      owner,
      isLost: true,
    }),
    this.petModel.countDocuments({
      owner,
      isLost: false,
    }),
  ]);

   return {
     totalPets,
     lostPets,
     foundPets,
    };
  }
  async findOwnedPet(
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

 async count(): Promise<number> {
  return this.petModel.countDocuments();
  }

  async countLost(): Promise<number> {
  return this.petModel.countDocuments({
    isLost: true,
  });
 }

 async countRecovered(): Promise<number> {
  return this.petModel.countDocuments({
    isLost: false,
  });
 }


}