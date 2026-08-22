import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { QueryFilter, Model, Types } from 'mongoose';
import { nanoid } from 'nanoid';
import { Pet, PetDocument } from './schemas/pet.schema';
import { CreatePetDto } from './dto/create-pet.dto';
import { UpdatePetDto } from './dto/update-pet.dto';
import { AdminPetQueryDto } from '../admin/dto/admin-pet-query.dto';
import { QrService } from '../qr/qr.service';
import { ReportLostDto } from './dto/report-lost.dto';

@Injectable()
export class PetsService {
  constructor(
    @InjectModel(Pet.name)
    private readonly petModel: Model<PetDocument>,

    private readonly qrService: QrService,
  ) {}

  async create(ownerId: string, createPetDto: CreatePetDto) {
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

  async findOne(ownerId: string, petId: string) {
    const pet = await this.petModel.findOne({
      _id: petId,
      owner: new Types.ObjectId(ownerId),
    });

    if (!pet) {
      throw new NotFoundException('Pet not found');
    }

    return pet;
  }

  async update(ownerId: string, petId: string, updatePetDto: UpdatePetDto) {
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

  async remove(ownerId: string, petId: string) {
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

  async reportLost(ownerId: string, petId: string, dto: ReportLostDto) {
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
      throw new NotFoundException('Pet not found');
    }

    return pet;
  }

  async reportFound(ownerId: string, petId: string) {
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

    const [totalPets, lostPets, foundPets] = await Promise.all([
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
  async findOwnedPet(ownerId: string, petId: string) {
    const pet = await this.petModel.findOne({
      _id: petId,
      owner: new Types.ObjectId(ownerId),
    });

    if (!pet) {
      throw new NotFoundException('Pet not found');
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

  async findAllAdmin(query: AdminPetQueryDto) {
    const { page, limit, search, species, isLost, sort, order } = query;

    interface PetAdminFilter {
      $or?: Array<{ [field: string]: { $regex: string; $options: string } }>;
      species?: string;
      isLost?: boolean;
    }

    const filter: PetAdminFilter = {};

    if (search) {
      filter.$or = [
        {
          name: {
            $regex: search,
            $options: 'i',
          },
        },
        {
          publicId: {
            $regex: search,
            $options: 'i',
          },
        },
      ];
    }

    if (species) {
      filter.species = species;
    }

    if (isLost !== undefined) {
      filter.isLost = isLost;
    }

    // Mongoose's QueryFilter<Pet> is too deeply recursive for eslint's type-aware
    // checker to resolve here, though tsc itself type-checks it fine.

    const queryFilter = filter as QueryFilter<Pet>;

    const total = await this.petModel.countDocuments(queryFilter);

    const pets = await this.petModel
      .find(queryFilter)
      .populate('owner', 'fullName email')
      .sort({
        [sort]: order === 'asc' ? 1 : -1,
      })
      .skip((page - 1) * limit)
      .limit(limit);

    return {
      pets,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findByIdAdmin(id: string) {
    return this.petModel.findById(id).populate('owner', 'fullName email');
  }

  async recoverPet(id: string) {
    return this.petModel.findByIdAndUpdate(
      id,
      {
        isLost: false,
        lostDate: null,
        lastSeenLocation: null,
        lostDescription: null,
        reward: null,
      },
      {
        new: true,
      },
    );
  }

  async deletePet(id: string) {
    await this.petModel.findByIdAndDelete(id);

    return {
      message: 'Pet deleted successfully',
    };
  }

  async topScannedPets() {
    return this.petModel
      .find()
      .sort({
        scanCount: -1,
      })
      .limit(10)
      .select('name publicId scanCount profileImage');
  }

  async speciesDistribution() {
    return this.petModel.aggregate<{ species: string; count: number }>([
      {
        $group: {
          _id: '$species',
          count: {
            $sum: 1,
          },
        },
      },
      {
        $project: {
          _id: 0,
          species: '$_id',
          count: 1,
        },
      },
    ]);
  }

  async monthlyRegistrations() {
    const months: number[] = new Array<number>(12).fill(0);

    const pets = (await this.petModel.find().lean().exec()) as Array<
      Pet & { createdAt?: Date }
    >;

    pets.forEach((pet) => {
      if (pet.createdAt) {
        months[new Date(pet.createdAt).getMonth()]++;
      }
    });

    return months;
  }
}
