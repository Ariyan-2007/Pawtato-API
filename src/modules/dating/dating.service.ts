import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import {
  PetDatingProfile,
  PetDatingProfileDocument,
} from './schemas/pet-dating-profile.schema';
import { Swipe, SwipeDocument } from './schemas/swipe.schema';
import { Match, MatchDocument } from './schemas/match.schema';
import { Message, MessageDocument } from './schemas/message.schema';
import {
  DatingReport,
  DatingReportDocument,
} from './schemas/dating-report.schema';
import { CreateDatingProfileDto } from './dto/create-dating-profile.dto';
import { UpdateDatingProfileDto } from './dto/update-dating-profile.dto';
import { DiscoverQueryDto } from './dto/discover-query.dto';
import { SwipeDto } from './dto/swipe.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { CreateDatingReportDto } from './dto/create-dating-report.dto';
import type { AdminDatingReportQueryDto } from '../admin/dto/admin-dating-report-query.dto';
import { DatingPurpose } from '../../common/enums/dating-purpose.enum';
import { SwipeAction } from '../../common/enums/swipe-action.enum';
import { MatchStatus } from '../../common/enums/match-status.enum';
import { DatingReportStatus } from '../../common/enums/dating-report-status.enum';
import { isDuplicateKeyError } from '../../common/utils/mongo.util';
import { PetsService } from '../pets/pets.service';
import { MedicalService } from '../medical/medical.service';
import { VaccinationsService } from '../vaccinations/vaccinations.service';
import { ActivityService } from '../activity/activity.service';

// Only cats and dogs may opt into dating — Pet.species is a free-text field
// platform-wide (no enum enforced there), so this allow-list is local to
// this module rather than a change to the core Pet schema.
const DATABLE_SPECIES = ['cat', 'dog'];

// `pet.owner` is a plain ObjectId when unpopulated but a full document when
// populated via PetsService.findByIdAdmin — mirrors the same normalization
// tags.service.ts already needs for the same reason.
function extractOwnerId(owner: unknown): string {
  if (owner && typeof owner === 'object' && '_id' in owner) {
    return String(owner._id);
  }

  return String(owner);
}

function purposesCompatible(a: DatingPurpose, b: DatingPurpose): boolean {
  return a === DatingPurpose.BOTH || b === DatingPurpose.BOTH || a === b;
}

// Stored in a fixed order (lower hex string first) so a lookup or a unique
// index never has to check both (petAId, petBId) and (petBId, petAId).
function canonicalPair(
  a: Types.ObjectId,
  b: Types.ObjectId,
): [Types.ObjectId, Types.ObjectId] {
  return a.toString() < b.toString() ? [a, b] : [b, a];
}

@Injectable()
export class DatingService {
  constructor(
    @InjectModel(PetDatingProfile.name)
    private readonly profileModel: Model<PetDatingProfileDocument>,
    @InjectModel(Swipe.name)
    private readonly swipeModel: Model<SwipeDocument>,
    @InjectModel(Match.name)
    private readonly matchModel: Model<MatchDocument>,
    @InjectModel(Message.name)
    private readonly messageModel: Model<MessageDocument>,
    @InjectModel(DatingReport.name)
    private readonly datingReportModel: Model<DatingReportDocument>,

    private readonly petsService: PetsService,
    private readonly medicalService: MedicalService,
    private readonly vaccinationsService: VaccinationsService,
    private readonly activityService: ActivityService,
  ) {}

  private assertDatableSpecies(species: string) {
    if (!DATABLE_SPECIES.includes(species.trim().toLowerCase())) {
      throw new BadRequestException(
        'Dating is only available for cats and dogs',
      );
    }
  }

  async createProfile(
    ownerId: string,
    petId: string,
    dto: CreateDatingProfileDto,
  ) {
    const pet = await this.petsService.findOwnedPet(ownerId, petId);
    this.assertDatableSpecies(pet.species);

    const existing = await this.profileModel.findOne({ petId: pet._id });

    if (existing) {
      throw new BadRequestException(
        'This pet already has a dating profile — use PATCH to update it',
      );
    }

    return this.profileModel.create({
      petId: pet._id,
      purpose: dto.purpose,
      bio: dto.bio,
      temperamentTags: dto.temperamentTags ?? [],
      photos: dto.photos ?? [],
      approxLocation: dto.approxLocation,
    });
  }

  async updateProfile(
    ownerId: string,
    petId: string,
    dto: UpdateDatingProfileDto,
  ) {
    const pet = await this.petsService.findOwnedPet(ownerId, petId);
    const profile = await this.profileModel.findOne({ petId: pet._id });

    if (!profile) {
      throw new NotFoundException('Dating profile not found');
    }

    if (dto.purpose !== undefined) profile.purpose = dto.purpose;
    if (dto.bio !== undefined) profile.bio = dto.bio;
    if (dto.temperamentTags !== undefined)
      profile.temperamentTags = dto.temperamentTags;
    if (dto.photos !== undefined) profile.photos = dto.photos;
    if (dto.approxLocation !== undefined)
      profile.approxLocation = dto.approxLocation;
    if (dto.isActive !== undefined) profile.isActive = dto.isActive;

    await profile.save();

    return profile;
  }

  // The only way `healthVerified` ever becomes true — deliberately not part
  // of create/update's accepted fields, since it's meant to reflect real
  // records existing, not the owner's say-so. "Cross-referencing" is
  // interpreted here as: at least one medical record AND one vaccination
  // record already exist for this pet.
  async verifyHealth(ownerId: string, petId: string) {
    const pet = await this.petsService.findOwnedPet(ownerId, petId);
    const profile = await this.profileModel.findOne({ petId: pet._id });

    if (!profile) {
      throw new NotFoundException('Dating profile not found');
    }

    if (profile.purpose === DatingPurpose.PLAYDATE) {
      throw new BadRequestException(
        'Health verification only applies to BREEDING or BOTH profiles',
      );
    }

    const [medicalRecords, vaccinations] = await Promise.all([
      this.medicalService.findAll(ownerId, petId),
      this.vaccinationsService.findAll(ownerId, petId),
    ]);

    if (medicalRecords.length === 0 || vaccinations.length === 0) {
      throw new BadRequestException(
        'Add at least one medical record and one vaccination record for this pet before requesting health verification',
      );
    }

    profile.healthVerified = true;
    await profile.save();

    return profile;
  }

  async discover(ownerId: string, query: DiscoverQueryDto) {
    const { petId, page, limit } = query;
    const pet = await this.petsService.findOwnedPet(ownerId, petId);
    const profile = await this.profileModel.findOne({ petId: pet._id });

    if (!profile) {
      throw new BadRequestException(
        'Create a dating profile for this pet first',
      );
    }

    if (!profile.isActive) {
      throw new BadRequestException(
        "Activate this pet's dating profile before discovering others",
      );
    }

    const compatiblePurposes =
      profile.purpose === DatingPurpose.BOTH
        ? [DatingPurpose.PLAYDATE, DatingPurpose.BREEDING, DatingPurpose.BOTH]
        : [profile.purpose, DatingPurpose.BOTH];

    const [ownPetIds, swipedPetIds, sameSpeciesPetIds] = await Promise.all([
      this.petsService.findIdsForOwner(ownerId),
      this.swipeModel.distinct('toPetId', { fromPetId: pet._id }),
      this.petsService.findIdsBySpecies(pet.species),
    ]);

    const excludeIds = new Set<string>([
      ...ownPetIds,
      ...swipedPetIds.map((id) => id.toString()),
    ]);

    const candidateIds = sameSpeciesPetIds
      .filter((id) => !excludeIds.has(id))
      .map((id) => new Types.ObjectId(id));

    const filter = {
      petId: { $in: candidateIds },
      purpose: { $in: compatiblePurposes },
      isActive: true,
    };

    const total = await this.profileModel.countDocuments(filter);

    const profiles = await this.profileModel
      .find(filter)
      .populate('petId', 'name species breed profileImage')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    return {
      profiles,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async swipe(ownerId: string, dto: SwipeDto) {
    if (dto.fromPetId === dto.toPetId) {
      throw new BadRequestException('A pet cannot swipe itself');
    }

    const fromPet = await this.petsService.findOwnedPet(ownerId, dto.fromPetId);
    const toPet = await this.petsService.findByIdAdmin(dto.toPetId);

    if (!toPet) {
      throw new NotFoundException('Pet not found');
    }

    const [fromProfile, toProfile] = await Promise.all([
      this.profileModel.findOne({ petId: fromPet._id }),
      this.profileModel.findOne({ petId: toPet._id }),
    ]);

    if (!fromProfile || !fromProfile.isActive) {
      throw new BadRequestException(
        'Create and activate a dating profile for this pet first',
      );
    }

    if (!toProfile || !toProfile.isActive) {
      throw new BadRequestException('This pet is not available for matching');
    }

    if (
      fromPet.species.trim().toLowerCase() !==
      toPet.species.trim().toLowerCase()
    ) {
      throw new BadRequestException(
        'Pets can only be matched with the same species',
      );
    }

    if (!purposesCompatible(fromProfile.purpose, toProfile.purpose)) {
      throw new BadRequestException(
        "These pets' dating purposes are not compatible",
      );
    }

    let swipe: SwipeDocument;

    try {
      swipe = await this.swipeModel.create({
        fromPetId: fromPet._id,
        toPetId: toPet._id,
        action: dto.action,
      });
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new BadRequestException('You already swiped on this pet');
      }

      throw error;
    }

    if (dto.action !== SwipeAction.LIKE) {
      return { swipe, match: null };
    }

    const reciprocal = await this.swipeModel.findOne({
      fromPetId: toPet._id,
      toPetId: fromPet._id,
      action: SwipeAction.LIKE,
    });

    if (!reciprocal) {
      return { swipe, match: null };
    }

    const [petAId, petBId] = canonicalPair(fromPet._id, toPet._id);

    let match: MatchDocument;

    try {
      match = await this.matchModel.create({ petAId, petBId });
    } catch (error) {
      if (!isDuplicateKeyError(error)) {
        throw error;
      }

      // Two near-simultaneous swipe requests both detected the reciprocal
      // like and raced to create the match — the loser here isn't wrong,
      // the winner's document is just the one that stuck. Return it rather
      // than erroring, so both callers see the same successful outcome.
      const existing = await this.matchModel.findOne({ petAId, petBId });

      if (!existing) {
        throw error;
      }

      match = existing;
    }

    return { swipe, match };
  }

  async listMatches(ownerId: string) {
    const ownPetIds = (await this.petsService.findIdsForOwner(ownerId)).map(
      (id) => new Types.ObjectId(id),
    );

    return this.matchModel
      .find({
        status: MatchStatus.ACTIVE,
        $or: [{ petAId: { $in: ownPetIds } }, { petBId: { $in: ownPetIds } }],
      })
      .populate('petAId', 'name species breed profileImage')
      .populate('petBId', 'name species breed profileImage')
      .sort({ matchedAt: -1 });
  }

  private async getMatchOrThrow(matchId: string) {
    const match = await this.matchModel.findById(matchId);

    if (!match) {
      throw new NotFoundException('Match not found');
    }

    return match;
  }

  // IDOR-safe by design (matches the rest of the codebase's convention):
  // a caller who doesn't own either side gets the same 404 as a nonexistent
  // match id, never a distinguishing 403.
  private async assertOwnsSideOfMatch(ownerId: string, match: MatchDocument) {
    const [petA, petB] = await Promise.all([
      this.petsService.findByIdAdmin(match.petAId.toString()),
      this.petsService.findByIdAdmin(match.petBId.toString()),
    ]);

    const ownsA = petA && extractOwnerId(petA.owner) === ownerId;
    const ownsB = petB && extractOwnerId(petB.owner) === ownerId;

    if (!ownsA && !ownsB) {
      throw new NotFoundException('Match not found');
    }
  }

  async listMessages(ownerId: string, matchId: string) {
    const match = await this.getMatchOrThrow(matchId);
    await this.assertOwnsSideOfMatch(ownerId, match);

    return this.messageModel.find({ matchId: match._id }).sort({
      createdAt: 1,
    });
  }

  async sendMessage(ownerId: string, matchId: string, dto: CreateMessageDto) {
    const match = await this.getMatchOrThrow(matchId);
    await this.assertOwnsSideOfMatch(ownerId, match);

    if (match.status !== MatchStatus.ACTIVE) {
      throw new BadRequestException('This match has ended');
    }

    return this.messageModel.create({
      matchId: match._id,
      senderUserId: new Types.ObjectId(ownerId),
      content: dto.content,
    });
  }

  async unmatch(ownerId: string, matchId: string) {
    const match = await this.getMatchOrThrow(matchId);
    await this.assertOwnsSideOfMatch(ownerId, match);

    match.status = MatchStatus.UNMATCHED;
    await match.save();

    return { message: 'Unmatched successfully' };
  }

  async report(reporterId: string, dto: CreateDatingReportDto) {
    const targetPet = await this.petsService.findByIdAdmin(dto.targetPetId);

    if (!targetPet) {
      throw new NotFoundException('Pet not found');
    }

    const profile = await this.profileModel.findOne({
      petId: targetPet._id,
    });

    if (!profile) {
      throw new NotFoundException('This pet has no dating profile to report');
    }

    const report = await this.datingReportModel.create({
      reporterUserId: new Types.ObjectId(reporterId),
      targetPetId: targetPet._id,
      reason: dto.reason,
    });

    await this.activityService.log(
      reporterId,
      'dating.report.created',
      report._id.toString(),
      { targetPetId: dto.targetPetId },
    );

    return { message: 'Report submitted. Our team will review it.' };
  }

  // --- Admin ---

  async adminListReports(query: AdminDatingReportQueryDto) {
    const { page, limit, status } = query;
    const filter = status ? { status } : {};

    const total = await this.datingReportModel.countDocuments(filter);

    const reports = await this.datingReportModel
      .find(filter)
      .populate('targetPetId', 'name species')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    return {
      reports,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async adminUpdateReportStatus(
    actorId: string,
    id: string,
    status: DatingReportStatus,
  ) {
    const report = await this.datingReportModel.findByIdAndUpdate(
      id,
      {
        status,
        reviewedBy: new Types.ObjectId(actorId),
        reviewedAt: new Date(),
      },
      { new: true },
    );

    if (!report) {
      throw new NotFoundException('Dating report not found');
    }

    await this.activityService.log(
      actorId,
      'dating.report.status-changed',
      id,
      { status },
    );

    return report;
  }

  async adminDeactivateProfile(actorId: string, petId: string) {
    const profile = await this.profileModel.findOneAndUpdate(
      { petId: new Types.ObjectId(petId) },
      { isActive: false },
      { new: true },
    );

    if (!profile) {
      throw new NotFoundException('Dating profile not found');
    }

    await this.activityService.log(
      actorId,
      'admin.dating-profile.deactivated',
      petId,
    );

    return profile;
  }

  // --- Cascade delete (see AdminService.cascadeDeleteUserData / deletePet) ---

  async deleteAllForPets(petIds: string[]) {
    if (petIds.length === 0) {
      return { deletedCount: 0 };
    }

    const objectIds = petIds.map((id) => new Types.ObjectId(id));

    const matches = await this.matchModel.find({
      $or: [{ petAId: { $in: objectIds } }, { petBId: { $in: objectIds } }],
    });
    const matchIds = matches.map((match) => match._id);

    await this.messageModel.deleteMany({ matchId: { $in: matchIds } });
    await this.matchModel.deleteMany({ _id: { $in: matchIds } });
    await this.swipeModel.deleteMany({
      $or: [{ fromPetId: { $in: objectIds } }, { toPetId: { $in: objectIds } }],
    });
    await this.datingReportModel.deleteMany({
      targetPetId: { $in: objectIds },
    });

    const result = await this.profileModel.deleteMany({
      petId: { $in: objectIds },
    });

    return { deletedCount: result.deletedCount };
  }

  async deleteReportsByReporter(userId: string) {
    const result = await this.datingReportModel.deleteMany({
      reporterUserId: new Types.ObjectId(userId),
    });

    return { deletedCount: result.deletedCount };
  }
}
