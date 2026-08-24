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
import { DatingMode } from '../../common/enums/dating-mode.enum';
import { SwipeAction } from '../../common/enums/swipe-action.enum';
import { MatchStatus } from '../../common/enums/match-status.enum';
import { DatingReportStatus } from '../../common/enums/dating-report-status.enum';
import { isDuplicateKeyError } from '../../common/utils/mongo.util';
import { PetsService } from '../pets/pets.service';
import { MedicalService } from '../medical/medical.service';
import { VaccinationsService } from '../vaccinations/vaccinations.service';
import { ActivityService } from '../activity/activity.service';
import { IdentityVerificationService } from './identity-verification.service';

// Only cats and dogs may opt into dating — Pet.species is a free-text field
// platform-wide (no enum enforced there), so this allow-list is local to
// this module rather than a change to the core Pet schema. Applies
// regardless of mode — PLAYDATE being "universal" means "any species pair
// among eligible species," not literally any species.
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
    private readonly identityVerificationService: IdentityVerificationService,
  ) {}

  private assertDatableSpecies(species: string) {
    if (!DATABLE_SPECIES.includes(species.trim().toLowerCase())) {
      throw new BadRequestException(
        'Dating is only available for cats and dogs',
      );
    }
  }

  // Computed live from real records, never stored on the profile itself —
  // only ever called when the profile's own owner has opted into
  // `shareHealthSummary` (see discover()/getProfile()). No spay/neuter
  // field exists anywhere in this codebase's Pet schema, so this reports
  // only what's actually derivable: vaccination currency and record counts.
  private async buildMedicalSummary(petId: string) {
    const [medicalRecords, vaccinations] = await Promise.all([
      this.medicalService.findAllByPet(petId),
      this.vaccinationsService.findAllByPet(petId),
    ]);

    const now = new Date();
    const vaccinationsUpToDate =
      vaccinations.length > 0 &&
      vaccinations.every((v) => v.nextDueDate >= now);

    const lastVaccinationDate = vaccinations.reduce<Date | null>(
      (latest, v) =>
        !latest || v.administeredDate > latest ? v.administeredDate : latest,
      null,
    );

    return {
      medicalRecordCount: medicalRecords.length,
      vaccinationCount: vaccinations.length,
      vaccinationsUpToDate,
      lastVaccinationDate,
    };
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
      modes: dto.modes,
      bio: dto.bio,
      temperamentTags: dto.temperamentTags ?? [],
      likes: dto.likes ?? [],
      dislikes: dto.dislikes ?? [],
      photos: dto.photos,
      approxLocation: dto.approxLocation,
      shareHealthSummary: dto.shareHealthSummary ?? false,
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

    if (dto.modes !== undefined) {
      if (dto.modes.length === 0) {
        throw new BadRequestException(
          'At least one dating mode must stay enabled',
        );
      }
      profile.modes = dto.modes;
    }
    if (dto.bio !== undefined) profile.bio = dto.bio;
    if (dto.temperamentTags !== undefined)
      profile.temperamentTags = dto.temperamentTags;
    if (dto.likes !== undefined) profile.likes = dto.likes;
    if (dto.dislikes !== undefined) profile.dislikes = dto.dislikes;
    if (dto.photos !== undefined) profile.photos = dto.photos;
    if (dto.approxLocation !== undefined)
      profile.approxLocation = dto.approxLocation;
    if (dto.shareHealthSummary !== undefined)
      profile.shareHealthSummary = dto.shareHealthSummary;
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

    if (!profile.modes.includes(DatingMode.BREEDING)) {
      throw new BadRequestException(
        'Health verification only applies to profiles with BREEDING enabled',
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

  // A pet's own full dating profile — used for "View full profile" and the
  // Matched Profile Detail screen. Viewable by anyone while active; the
  // owner can also view it while paused (isActive: false).
  async getProfile(viewerId: string, petId: string) {
    const profile = await this.profileModel
      .findOne({ petId: new Types.ObjectId(petId) })
      .populate('petId', 'name species breed profileImage');

    if (!profile) {
      throw new NotFoundException('Dating profile not found');
    }

    const ownerMap = await this.petsService.findOwnersForPets([petId]);
    const ownerId = ownerMap.get(petId);
    const isOwner = ownerId === viewerId;

    if (!profile.isActive && !isOwner) {
      throw new NotFoundException('Dating profile not found');
    }

    const [ownerVerified, medicalSummary] = await Promise.all([
      ownerId
        ? this.identityVerificationService.isApproved(ownerId)
        : Promise.resolve(false),
      profile.shareHealthSummary
        ? this.buildMedicalSummary(petId)
        : Promise.resolve(undefined),
    ]);

    return {
      ...profile.toObject(),
      ownerVerified,
      ...(medicalSummary ? { medicalSummary } : {}),
    };
  }

  async discover(ownerId: string, query: DiscoverQueryDto) {
    const { petId, mode, verifiedOnly, page, limit } = query;
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

    if (!profile.modes.includes(mode)) {
      throw new BadRequestException(
        `Enable ${mode} on this pet's dating profile before discovering in that mode`,
      );
    }

    if (
      verifiedOnly &&
      !(await this.identityVerificationService.isApproved(ownerId))
    ) {
      throw new BadRequestException(
        'Verify your identity to use the verified-only filter',
      );
    }

    const [ownPetIds, swipedPetIds] = await Promise.all([
      this.petsService.findIdsForOwner(ownerId),
      this.swipeModel.distinct('toPetId', { fromPetId: pet._id, mode }),
    ]);

    const excludeIds = new Set<string>([
      ...ownPetIds,
      ...swipedPetIds.map((id) => id.toString()),
    ]);

    const profileFilter: Record<string, unknown> = {
      modes: mode,
      isActive: true,
    };

    // BREEDING is species-restricted; PLAYDATE is universal — the profile
    // filter alone (modes + isActive) is enough there, since species
    // eligibility was already enforced once at profile-creation time.
    if (mode === DatingMode.BREEDING) {
      const sameSpeciesPetIds = await this.petsService.findIdsBySpecies(
        pet.species,
      );
      const eligible = sameSpeciesPetIds.filter((id) => !excludeIds.has(id));
      profileFilter.petId = {
        $in: eligible.map((id) => new Types.ObjectId(id)),
      };
    } else {
      profileFilter.petId = {
        $nin: [...excludeIds].map((id) => new Types.ObjectId(id)),
      };
    }

    let candidatePetIds = await this.profileModel.distinct(
      'petId',
      profileFilter,
    );

    if (verifiedOnly) {
      const ownerMap = await this.petsService.findOwnersForPets(
        candidatePetIds.map((id) => id.toString()),
      );
      const approvedOwners =
        await this.identityVerificationService.getApprovedUserIds([
          ...new Set(ownerMap.values()),
        ]);

      candidatePetIds = candidatePetIds.filter((id) =>
        approvedOwners.has(ownerMap.get(id.toString()) ?? ''),
      );
    }

    const filter = { petId: { $in: candidatePetIds } };

    const total = await this.profileModel.countDocuments(filter);

    const profiles = await this.profileModel
      .find(filter)
      .populate('petId', 'name species breed profileImage')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const pageOwnerMap = await this.petsService.findOwnersForPets(
      profiles.map((p) =>
        (p.petId as unknown as { _id: Types.ObjectId })._id.toString(),
      ),
    );
    const approvedOnPage =
      await this.identityVerificationService.getApprovedUserIds([
        ...new Set(pageOwnerMap.values()),
      ]);

    const enriched = await Promise.all(
      profiles.map(async (p) => {
        const candidatePetId = (
          p.petId as unknown as { _id: Types.ObjectId }
        )._id.toString();
        const ownerId = pageOwnerMap.get(candidatePetId);

        const medicalSummary = p.shareHealthSummary
          ? await this.buildMedicalSummary(candidatePetId)
          : undefined;

        return {
          ...p.toObject(),
          ownerVerified: ownerId ? approvedOnPage.has(ownerId) : false,
          ...(medicalSummary ? { medicalSummary } : {}),
        };
      }),
    );

    return {
      profiles: enriched,
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

    if (!fromProfile.modes.includes(dto.mode)) {
      throw new BadRequestException(
        `Enable ${dto.mode} on this pet's dating profile before swiping in that mode`,
      );
    }

    if (!toProfile.modes.includes(dto.mode)) {
      throw new BadRequestException(
        `This pet is not available for ${dto.mode} matching`,
      );
    }

    // BREEDING is species-restricted; PLAYDATE is universal — mirrors
    // discover()'s pool rule exactly, re-checked here since a client is
    // never trusted to have honored discover()'s filtering.
    if (
      dto.mode === DatingMode.BREEDING &&
      fromPet.species.trim().toLowerCase() !==
        toPet.species.trim().toLowerCase()
    ) {
      throw new BadRequestException(
        'BREEDING matches must be the same species',
      );
    }

    let swipe: SwipeDocument;

    try {
      swipe = await this.swipeModel.create({
        fromPetId: fromPet._id,
        toPetId: toPet._id,
        action: dto.action,
        mode: dto.mode,
      });
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new BadRequestException(
          'You already swiped on this pet in this mode',
        );
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
      mode: dto.mode,
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

    const matches = await this.matchModel
      .find({
        status: MatchStatus.ACTIVE,
        $or: [{ petAId: { $in: ownPetIds } }, { petBId: { $in: ownPetIds } }],
      })
      .populate('petAId', 'name species breed profileImage')
      .populate('petBId', 'name species breed profileImage')
      .sort({ matchedAt: -1 });

    // `mode` isn't stored on Match itself (see PAWTATO_ROADMAP.md Phase 11)
    // — reconstructed from the originating reciprocal-LIKE Swipe pair for
    // display purposes (e.g. the frontend's Matches List mode icon).
    return Promise.all(
      matches.map(async (match) => {
        const petA = match.petAId as unknown as { _id: Types.ObjectId };
        const petB = match.petBId as unknown as { _id: Types.ObjectId };

        const originatingSwipe = await this.swipeModel
          .findOne({
            $or: [
              {
                fromPetId: petA._id,
                toPetId: petB._id,
                action: SwipeAction.LIKE,
              },
              {
                fromPetId: petB._id,
                toPetId: petA._id,
                action: SwipeAction.LIKE,
              },
            ],
          })
          .sort({ createdAt: 1 });

        return { ...match.toObject(), mode: originatingSwipe?.mode ?? null };
      }),
    );
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

  // Explicit per-match consent (decided 2026-08-25 — see PAWTATO_ROADMAP.md
  // Phase 11): sharing is per-direction and scoped to this one match only.
  // Requires the caller to be APPROVED (they must have an NID on file to
  // share it at all).
  async shareNid(ownerId: string, matchId: string) {
    const match = await this.getMatchOrThrow(matchId);
    await this.assertOwnsSideOfMatch(ownerId, match);

    if (!(await this.identityVerificationService.isApproved(ownerId))) {
      throw new BadRequestException(
        'Verify your identity before sharing it in a match',
      );
    }

    const userObjectId = new Types.ObjectId(ownerId);

    if (!match.nidSharedBy.some((id) => id.equals(userObjectId))) {
      match.nidSharedBy.push(userObjectId);
      await match.save();
    }

    await this.activityService.log(ownerId, 'dating.nid.shared', matchId);

    return { message: 'Your ID is now shared in this match.' };
  }

  // Returns the *other* party's signed NID URLs — only once they've shared
  // (shareNid()) and are still currently APPROVED. The caller must also be
  // APPROVED themselves (the "Identity Sharing" section doesn't exist for
  // an ineligible match at all — see PAWTATO_FRONTEND_BLUEPRINT.md).
  async getNidExchange(ownerId: string, matchId: string) {
    const match = await this.getMatchOrThrow(matchId);
    await this.assertOwnsSideOfMatch(ownerId, match);

    if (!(await this.identityVerificationService.isApproved(ownerId))) {
      throw new BadRequestException(
        'You must be verified to view identity exchange in this match',
      );
    }

    const [petA, petB] = await Promise.all([
      this.petsService.findByIdAdmin(match.petAId.toString()),
      this.petsService.findByIdAdmin(match.petBId.toString()),
    ]);

    const ownsA = petA && extractOwnerId(petA.owner) === ownerId;
    const otherPet = ownsA ? petB : petA;

    if (!otherPet) {
      throw new NotFoundException('Match not found');
    }

    const otherOwnerId = extractOwnerId(otherPet.owner);

    const hasShared = match.nidSharedBy.some(
      (id) => id.toString() === otherOwnerId,
    );

    if (!hasShared) {
      throw new BadRequestException(
        'The other side has not shared their ID in this match yet',
      );
    }

    if (!(await this.identityVerificationService.isApproved(otherOwnerId))) {
      throw new BadRequestException('The other side is no longer verified');
    }

    const urls =
      await this.identityVerificationService.getSignedNidUrls(otherOwnerId);

    await this.activityService.log(ownerId, 'dating.nid.viewed', matchId, {
      viewedOwnerId: otherOwnerId,
    });

    return urls;
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
