import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { QueryFilter, Model, Types } from 'mongoose';
import { Pet, PetDocument } from './schemas/pet.schema';
import { CreatePetDto } from './dto/create-pet.dto';
import { UpdatePetDto } from './dto/update-pet.dto';
import { AdminPetQueryDto } from '../admin/dto/admin-pet-query.dto';
import { ReportLostDto } from './dto/report-lost.dto';
import { User } from '../users/schemas/user.schema';
import { DOMAIN_EVENTS } from '../../common/events/domain-events';
import { STORAGE_PROVIDER } from '../storage/storage.constants';
import type { StorageProvider } from '../storage/interfaces/storage-provider.interface';
import { ActivityService } from '../activity/activity.service';
import { escapeRegExp } from '../../common/utils/regex.util';

@Injectable()
export class PetsService {
  private readonly logger = new Logger(PetsService.name);

  constructor(
    @InjectModel(Pet.name)
    private readonly petModel: Model<PetDocument>,

    private readonly eventEmitter: EventEmitter2,
    private readonly activityService: ActivityService,

    @Inject(STORAGE_PROVIDER)
    private readonly storageProvider: StorageProvider,
  ) {}

  async create(ownerId: string, createPetDto: CreatePetDto) {
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

  async updatePhoto(ownerId: string, petId: string, profileImage: string) {
    const existing = await this.petModel
      .findOne({ _id: petId, owner: new Types.ObjectId(ownerId) })
      .select('profileImage');

    if (!existing) {
      throw new NotFoundException('Pet not found');
    }

    const previousProfileImage = existing.profileImage;

    const pet = await this.petModel.findOneAndUpdate(
      {
        _id: petId,
        owner: new Types.ObjectId(ownerId),
      },
      { profileImage },
      { new: true },
    );

    if (!pet) {
      throw new NotFoundException('Pet not found');
    }

    // The new photo is already linked at this point — only now is it safe to
    // remove the old file. A failed cleanup shouldn't fail an otherwise
    // successful upload; it just leaves an orphaned object behind.
    await this.deleteOldPhoto(previousProfileImage);

    return pet;
  }

  async removePhoto(ownerId: string, petId: string) {
    const existing = await this.petModel
      .findOne({ _id: petId, owner: new Types.ObjectId(ownerId) })
      .select('profileImage');

    if (!existing) {
      throw new NotFoundException('Pet not found');
    }

    const previousProfileImage = existing.profileImage;

    await this.petModel.updateOne(
      { _id: petId, owner: new Types.ObjectId(ownerId) },
      { profileImage: '' },
    );

    await this.deleteOldPhoto(previousProfileImage);

    return { message: 'Photo removed successfully' };
  }

  private async deleteOldPhoto(url?: string | null) {
    if (!url) {
      return;
    }

    try {
      await this.storageProvider.deleteByUrl(url);
    } catch (error) {
      this.logger.error(
        `Failed to delete previous pet photo: ${url}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  async remove(ownerId: string, petId: string) {
    const pet = await this.petModel.findOneAndDelete({
      _id: petId,
      owner: new Types.ObjectId(ownerId),
    });

    if (!pet) {
      throw new NotFoundException('Pet not found');
    }

    await this.deleteOldPhoto(pet.profileImage);

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

    await this.emitOwnerEvent(DOMAIN_EVENTS.PET_MARKED_LOST, ownerId, pet);

    await this.activityService.log(
      ownerId,
      DOMAIN_EVENTS.PET_MARKED_LOST,
      petId,
      { petName: pet.name },
    );

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

    await this.emitOwnerEvent(DOMAIN_EVENTS.PET_MARKED_FOUND, ownerId, pet);

    await this.activityService.log(
      ownerId,
      DOMAIN_EVENTS.PET_MARKED_FOUND,
      petId,
      { petName: pet.name },
    );

    return pet;
  }

  // A failed populate/emit must never fail the request that already succeeded.
  private async emitOwnerEvent(
    event:
      | typeof DOMAIN_EVENTS.PET_MARKED_LOST
      | typeof DOMAIN_EVENTS.PET_MARKED_FOUND,
    ownerId: string,
    pet: PetDocument,
  ) {
    try {
      await pet.populate('owner', 'email');

      const ownerEmail = (pet.owner as unknown as User).email;

      this.eventEmitter.emit(event, {
        ownerId,
        ownerEmail,
        petId: pet._id.toString(),
        petName: pet.name,
      });
    } catch {
      // Population failure shouldn't block the response; the notification is best-effort.
    }
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

  async findWithOwner(id: string) {
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
    const pet = await this.petModel.findByIdAndDelete(id);

    if (!pet) {
      throw new NotFoundException('Pet not found');
    }

    await this.deleteOldPhoto(pet.profileImage);

    return {
      message: 'Pet deleted successfully',
    };
  }

  // Read-only id lookup used by AdminService to compute the full set of
  // pets affected by a user-deletion cascade *before* deleting anything —
  // see AdminService.cascadeDeleteUserData. Kept separate from
  // deleteAllForOwner so a crash mid-cascade can always re-derive the same
  // ids on retry, rather than losing track of what's left to clean up
  // because the pets that would answer "whose data is this" are already gone.
  async findIdsForOwner(ownerId: string): Promise<string[]> {
    const ids = await this.petModel.distinct('_id', {
      owner: new Types.ObjectId(ownerId),
    });

    return ids.map((id) => id.toString());
  }

  // Cascade delete — every pet the user owns, plus each one's stored photo.
  // Callers are responsible for cleaning up anything that references these
  // pets first (medical records, vaccinations, scan history, found reports,
  // tags, dating profiles/matches) — see AdminService.cascadeDeleteUserData.
  async deleteAllForOwner(ownerId: string) {
    const objectId = new Types.ObjectId(ownerId);

    const pets = await this.petModel
      .find({ owner: objectId })
      .select('profileImage');

    for (const pet of pets) {
      await this.deleteOldPhoto(pet.profileImage);
    }

    await this.petModel.deleteMany({ owner: objectId });

    return { deletedCount: pets.length };
  }

  // Used by DatingService.discover() to keep species-matching at the DB
  // query level (so pagination stays correct) rather than filtering an
  // already-paginated page in application code.
  async findIdsBySpecies(species: string): Promise<string[]> {
    const ids = await this.petModel.distinct('_id', {
      species: { $regex: `^${escapeRegExp(species.trim())}$`, $options: 'i' },
    });

    return ids.map((id) => id.toString());
  }

  // Batched petId -> ownerId lookup — used by DatingService.discover()'s
  // `verifiedOnly` filter to check candidate owners' identity-verification
  // status without an N+1 round-trip per candidate.
  async findOwnersForPets(petIds: string[]): Promise<Map<string, string>> {
    if (petIds.length === 0) {
      return new Map();
    }

    const pets = await this.petModel
      .find({ _id: { $in: petIds.map((id) => new Types.ObjectId(id)) } })
      .select('owner');

    return new Map(
      pets.map((pet) => [pet._id.toString(), pet.owner.toString()]),
    );
  }

  async topScannedPets() {
    return this.petModel
      .find()
      .sort({
        scanCount: -1,
      })
      .limit(10)
      .select('name scanCount profileImage');
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
