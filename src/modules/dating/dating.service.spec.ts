import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';

import { DatingService } from './dating.service';
import { PetDatingProfile } from './schemas/pet-dating-profile.schema';
import { Swipe } from './schemas/swipe.schema';
import { Match } from './schemas/match.schema';
import { Message } from './schemas/message.schema';
import { DatingReport } from './schemas/dating-report.schema';
import { PetsService } from '../pets/pets.service';
import { MedicalService } from '../medical/medical.service';
import { VaccinationsService } from '../vaccinations/vaccinations.service';
import { ActivityService } from '../activity/activity.service';
import { DatingPurpose } from '../../common/enums/dating-purpose.enum';
import { SwipeAction } from '../../common/enums/swipe-action.enum';
import { MatchStatus } from '../../common/enums/match-status.enum';
import { DatingReportStatus } from '../../common/enums/dating-report-status.enum';

describe('DatingService', () => {
  let service: DatingService;
  let profileModel: {
    findOne: jest.Mock;
    find: jest.Mock;
    create: jest.Mock;
    countDocuments: jest.Mock;
    deleteMany: jest.Mock;
    findOneAndUpdate: jest.Mock;
  };
  let swipeModel: {
    create: jest.Mock;
    findOne: jest.Mock;
    distinct: jest.Mock;
    deleteMany: jest.Mock;
  };
  let matchModel: {
    create: jest.Mock;
    findOne: jest.Mock;
    findById: jest.Mock;
    find: jest.Mock;
    deleteMany: jest.Mock;
  };
  let messageModel: {
    create: jest.Mock;
    find: jest.Mock;
    deleteMany: jest.Mock;
  };
  let datingReportModel: {
    create: jest.Mock;
    find: jest.Mock;
    countDocuments: jest.Mock;
    findByIdAndUpdate: jest.Mock;
    deleteMany: jest.Mock;
  };
  let petsService: {
    findOwnedPet: jest.Mock;
    findByIdAdmin: jest.Mock;
    findIdsForOwner: jest.Mock;
    findIdsBySpecies: jest.Mock;
  };
  let medicalService: { findAll: jest.Mock };
  let vaccinationsService: { findAll: jest.Mock };
  let activityService: { log: jest.Mock };

  const ownerId = new Types.ObjectId().toString();
  const otherOwnerId = new Types.ObjectId().toString();
  const petId = new Types.ObjectId();
  const otherPetId = new Types.ObjectId();

  function makePet(overrides: Record<string, unknown> = {}) {
    return {
      _id: petId,
      species: 'Cat',
      owner: ownerId,
      ...overrides,
    };
  }

  beforeEach(async () => {
    profileModel = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      countDocuments: jest.fn(),
      deleteMany: jest.fn().mockResolvedValue({ deletedCount: 0 }),
      findOneAndUpdate: jest.fn(),
    };
    swipeModel = {
      create: jest.fn(),
      findOne: jest.fn(),
      distinct: jest.fn().mockResolvedValue([]),
      deleteMany: jest.fn().mockResolvedValue({ deletedCount: 0 }),
    };
    matchModel = {
      create: jest.fn(),
      findOne: jest.fn(),
      findById: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      deleteMany: jest.fn().mockResolvedValue({ deletedCount: 0 }),
    };
    messageModel = {
      create: jest.fn(),
      find: jest.fn(),
      deleteMany: jest.fn().mockResolvedValue({ deletedCount: 0 }),
    };
    datingReportModel = {
      create: jest.fn(),
      find: jest.fn(),
      countDocuments: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      deleteMany: jest.fn().mockResolvedValue({ deletedCount: 0 }),
    };
    petsService = {
      findOwnedPet: jest.fn().mockResolvedValue(makePet()),
      findByIdAdmin: jest.fn(),
      findIdsForOwner: jest.fn().mockResolvedValue([]),
      findIdsBySpecies: jest.fn().mockResolvedValue([]),
    };
    medicalService = { findAll: jest.fn().mockResolvedValue([]) };
    vaccinationsService = { findAll: jest.fn().mockResolvedValue([]) };
    activityService = { log: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DatingService,
        {
          provide: getModelToken(PetDatingProfile.name),
          useValue: profileModel,
        },
        { provide: getModelToken(Swipe.name), useValue: swipeModel },
        { provide: getModelToken(Match.name), useValue: matchModel },
        { provide: getModelToken(Message.name), useValue: messageModel },
        {
          provide: getModelToken(DatingReport.name),
          useValue: datingReportModel,
        },
        { provide: PetsService, useValue: petsService },
        { provide: MedicalService, useValue: medicalService },
        { provide: VaccinationsService, useValue: vaccinationsService },
        { provide: ActivityService, useValue: activityService },
      ],
    }).compile();

    service = module.get<DatingService>(DatingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createProfile', () => {
    it('creates a profile for a cat/dog pet with no existing profile', async () => {
      profileModel.findOne.mockResolvedValue(null);
      profileModel.create.mockResolvedValue({
        purpose: DatingPurpose.PLAYDATE,
      });

      await service.createProfile(ownerId, petId.toString(), {
        purpose: DatingPurpose.PLAYDATE,
      });

      expect(profileModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ petId, purpose: DatingPurpose.PLAYDATE }),
      );
    });

    it('rejects a species other than cat/dog', async () => {
      petsService.findOwnedPet.mockResolvedValue(
        makePet({ species: 'Parrot' }),
      );

      await expect(
        service.createProfile(ownerId, petId.toString(), {
          purpose: DatingPurpose.PLAYDATE,
        }),
      ).rejects.toThrow(BadRequestException);
      expect(profileModel.create).not.toHaveBeenCalled();
    });

    it('rejects creating a second profile for the same pet', async () => {
      profileModel.findOne.mockResolvedValue({ _id: new Types.ObjectId() });

      await expect(
        service.createProfile(ownerId, petId.toString(), {
          purpose: DatingPurpose.PLAYDATE,
        }),
      ).rejects.toThrow(BadRequestException);
      expect(profileModel.create).not.toHaveBeenCalled();
    });
  });

  describe('updateProfile', () => {
    it('throws NotFoundException when no profile exists', async () => {
      profileModel.findOne.mockResolvedValue(null);

      await expect(
        service.updateProfile(ownerId, petId.toString(), { bio: 'x' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('applies only the provided fields and saves', async () => {
      const profile = {
        purpose: DatingPurpose.PLAYDATE,
        bio: 'old',
        save: jest.fn().mockResolvedValue(undefined),
      };
      profileModel.findOne.mockResolvedValue(profile);

      await service.updateProfile(ownerId, petId.toString(), {
        bio: 'new bio',
      });

      expect(profile.bio).toBe('new bio');
      expect(profile.save).toHaveBeenCalled();
    });
  });

  describe('verifyHealth', () => {
    it('rejects a PLAYDATE-only profile', async () => {
      profileModel.findOne.mockResolvedValue({
        purpose: DatingPurpose.PLAYDATE,
      });

      await expect(
        service.verifyHealth(ownerId, petId.toString()),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects when medical/vaccination records are missing', async () => {
      profileModel.findOne.mockResolvedValue({
        purpose: DatingPurpose.BREEDING,
      });
      medicalService.findAll.mockResolvedValue([]);
      vaccinationsService.findAll.mockResolvedValue([{ _id: '1' }]);

      await expect(
        service.verifyHealth(ownerId, petId.toString()),
      ).rejects.toThrow(BadRequestException);
    });

    it('sets healthVerified true once both records exist', async () => {
      const profile = {
        purpose: DatingPurpose.BOTH,
        healthVerified: false,
        save: jest.fn().mockResolvedValue(undefined),
      };
      profileModel.findOne.mockResolvedValue(profile);
      medicalService.findAll.mockResolvedValue([{ _id: '1' }]);
      vaccinationsService.findAll.mockResolvedValue([{ _id: '2' }]);

      await service.verifyHealth(ownerId, petId.toString());

      expect(profile.healthVerified).toBe(true);
      expect(profile.save).toHaveBeenCalled();
    });
  });

  describe('discover', () => {
    it('throws BadRequestException when the swiping pet has no profile', async () => {
      profileModel.findOne.mockResolvedValue(null);

      await expect(
        service.discover(ownerId, {
          petId: petId.toString(),
          page: 1,
          limit: 10,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when the profile is inactive', async () => {
      profileModel.findOne.mockResolvedValue({
        isActive: false,
        purpose: DatingPurpose.PLAYDATE,
      });

      await expect(
        service.discover(ownerId, {
          petId: petId.toString(),
          page: 1,
          limit: 10,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('excludes own pets and already-swiped pets from the candidate filter', async () => {
      profileModel.findOne.mockResolvedValue({
        isActive: true,
        purpose: DatingPurpose.PLAYDATE,
      });
      petsService.findIdsForOwner.mockResolvedValue([petId.toString()]);
      swipeModel.distinct.mockResolvedValue([otherPetId]);
      petsService.findIdsBySpecies.mockResolvedValue([
        petId.toString(),
        otherPetId.toString(),
        new Types.ObjectId().toString(),
      ]);

      let capturedCandidateIds: Types.ObjectId[] = [];
      profileModel.countDocuments.mockImplementation(
        (filter: { petId: { $in: Types.ObjectId[] } }) => {
          capturedCandidateIds = filter.petId.$in;
          return Promise.resolve(0);
        },
      );
      const populate2 = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([]),
          }),
        }),
      });
      profileModel.find.mockReturnValue({ populate: populate2 });

      await service.discover(ownerId, {
        petId: petId.toString(),
        page: 1,
        limit: 10,
      });

      const candidateIds = capturedCandidateIds.map((id) => id.toString());

      expect(candidateIds).not.toContain(petId.toString());
      expect(candidateIds).not.toContain(otherPetId.toString());
    });
  });

  describe('swipe', () => {
    const fromPetId = petId.toString();
    const toPetId = otherPetId.toString();

    beforeEach(() => {
      petsService.findOwnedPet.mockResolvedValue(
        makePet({ _id: petId, species: 'Cat' }),
      );
      petsService.findByIdAdmin.mockResolvedValue(
        makePet({ _id: otherPetId, species: 'Cat', owner: otherOwnerId }),
      );
      profileModel.findOne.mockImplementation(
        ({ petId: id }: { petId: Types.ObjectId }) => {
          if (id.equals(petId)) {
            return Promise.resolve({
              isActive: true,
              purpose: DatingPurpose.PLAYDATE,
            });
          }
          return Promise.resolve({
            isActive: true,
            purpose: DatingPurpose.PLAYDATE,
          });
        },
      );
      swipeModel.create.mockResolvedValue({ _id: new Types.ObjectId() });
    });

    it('rejects a pet swiping itself', async () => {
      await expect(
        service.swipe(ownerId, {
          fromPetId,
          toPetId: fromPetId,
          action: SwipeAction.LIKE,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects mismatched species', async () => {
      petsService.findByIdAdmin.mockResolvedValue(
        makePet({ _id: otherPetId, species: 'Dog', owner: otherOwnerId }),
      );

      await expect(
        service.swipe(ownerId, {
          fromPetId,
          toPetId,
          action: SwipeAction.LIKE,
        }),
      ).rejects.toThrow(BadRequestException);
      expect(swipeModel.create).not.toHaveBeenCalled();
    });

    it('rejects incompatible purposes', async () => {
      profileModel.findOne
        .mockResolvedValueOnce({
          isActive: true,
          purpose: DatingPurpose.PLAYDATE,
        })
        .mockResolvedValueOnce({
          isActive: true,
          purpose: DatingPurpose.BREEDING,
        });

      await expect(
        service.swipe(ownerId, {
          fromPetId,
          toPetId,
          action: SwipeAction.LIKE,
        }),
      ).rejects.toThrow(BadRequestException);
      expect(swipeModel.create).not.toHaveBeenCalled();
    });

    it('rejects an inactive target profile', async () => {
      profileModel.findOne
        .mockResolvedValueOnce({
          isActive: true,
          purpose: DatingPurpose.PLAYDATE,
        })
        .mockResolvedValueOnce({
          isActive: false,
          purpose: DatingPurpose.PLAYDATE,
        });

      await expect(
        service.swipe(ownerId, {
          fromPetId,
          toPetId,
          action: SwipeAction.LIKE,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a duplicate swipe via the unique-index error', async () => {
      profileModel.findOne.mockResolvedValue({
        isActive: true,
        purpose: DatingPurpose.PLAYDATE,
      });
      swipeModel.create.mockRejectedValue({ code: 11000 });

      await expect(
        service.swipe(ownerId, {
          fromPetId,
          toPetId,
          action: SwipeAction.LIKE,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('PASS never creates a match', async () => {
      profileModel.findOne.mockResolvedValue({
        isActive: true,
        purpose: DatingPurpose.PLAYDATE,
      });

      const result = await service.swipe(ownerId, {
        fromPetId,
        toPetId,
        action: SwipeAction.PASS,
      });

      expect(result.match).toBeNull();
      expect(matchModel.create).not.toHaveBeenCalled();
    });

    it('LIKE without a reciprocal like returns match: null', async () => {
      profileModel.findOne.mockResolvedValue({
        isActive: true,
        purpose: DatingPurpose.PLAYDATE,
      });
      swipeModel.findOne.mockResolvedValue(null);

      const result = await service.swipe(ownerId, {
        fromPetId,
        toPetId,
        action: SwipeAction.LIKE,
      });

      expect(result.match).toBeNull();
      expect(matchModel.create).not.toHaveBeenCalled();
    });

    it('a mutual LIKE creates a Match in canonical pet-id order', async () => {
      profileModel.findOne.mockResolvedValue({
        isActive: true,
        purpose: DatingPurpose.PLAYDATE,
      });
      swipeModel.findOne.mockResolvedValue({ _id: new Types.ObjectId() });
      const createdMatch = { _id: new Types.ObjectId() };
      matchModel.create.mockResolvedValue(createdMatch);

      const result = await service.swipe(ownerId, {
        fromPetId,
        toPetId,
        action: SwipeAction.LIKE,
      });

      const [expectedA, expectedB] =
        petId.toString() < otherPetId.toString()
          ? [petId, otherPetId]
          : [otherPetId, petId];

      expect(matchModel.create).toHaveBeenCalledWith({
        petAId: expectedA,
        petBId: expectedB,
      });
      expect(result.match).toBe(createdMatch);
    });

    it('a race on match creation returns the already-created match instead of erroring', async () => {
      profileModel.findOne.mockResolvedValue({
        isActive: true,
        purpose: DatingPurpose.PLAYDATE,
      });
      swipeModel.findOne.mockResolvedValue({ _id: new Types.ObjectId() });
      matchModel.create.mockRejectedValue({ code: 11000 });
      const existingMatch = { _id: new Types.ObjectId() };
      matchModel.findOne.mockResolvedValue(existingMatch);

      const result = await service.swipe(ownerId, {
        fromPetId,
        toPetId,
        action: SwipeAction.LIKE,
      });

      expect(result.match).toBe(existingMatch);
    });
  });

  describe('match-scoped actions (messages/unmatch)', () => {
    const matchId = new Types.ObjectId().toString();

    function makeMatch(overrides: Record<string, unknown> = {}) {
      return {
        _id: matchId,
        petAId: petId,
        petBId: otherPetId,
        status: MatchStatus.ACTIVE,
        save: jest.fn().mockResolvedValue(undefined),
        ...overrides,
      };
    }

    it('listMessages throws NotFoundException for an unknown match', async () => {
      matchModel.findById.mockResolvedValue(null);

      await expect(service.listMessages(ownerId, matchId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('listMessages throws NotFoundException when the caller owns neither side (IDOR-safe)', async () => {
      matchModel.findById.mockResolvedValue(makeMatch());
      petsService.findByIdAdmin
        .mockResolvedValueOnce(makePet({ _id: petId, owner: otherOwnerId }))
        .mockResolvedValueOnce(
          makePet({ _id: otherPetId, owner: otherOwnerId }),
        );

      await expect(service.listMessages(ownerId, matchId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('listMessages succeeds when the caller owns one side', async () => {
      matchModel.findById.mockResolvedValue(makeMatch());
      petsService.findByIdAdmin
        .mockResolvedValueOnce(makePet({ _id: petId, owner: ownerId }))
        .mockResolvedValueOnce(
          makePet({ _id: otherPetId, owner: otherOwnerId }),
        );
      const sort = jest.fn().mockResolvedValue([]);
      messageModel.find.mockReturnValue({ sort });

      await service.listMessages(ownerId, matchId);

      expect(messageModel.find).toHaveBeenCalledWith({ matchId });
    });

    it('sendMessage rejects once the match has ended', async () => {
      matchModel.findById.mockResolvedValue(
        makeMatch({ status: MatchStatus.UNMATCHED }),
      );
      petsService.findByIdAdmin
        .mockResolvedValueOnce(makePet({ _id: petId, owner: ownerId }))
        .mockResolvedValueOnce(
          makePet({ _id: otherPetId, owner: otherOwnerId }),
        );

      await expect(
        service.sendMessage(ownerId, matchId, { content: 'hi' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('sendMessage creates a message from the caller', async () => {
      matchModel.findById.mockResolvedValue(makeMatch());
      petsService.findByIdAdmin
        .mockResolvedValueOnce(makePet({ _id: petId, owner: ownerId }))
        .mockResolvedValueOnce(
          makePet({ _id: otherPetId, owner: otherOwnerId }),
        );
      messageModel.create.mockResolvedValue({ content: 'hi' });

      await service.sendMessage(ownerId, matchId, { content: 'hi' });

      expect(messageModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ matchId, content: 'hi' }),
      );
    });

    it('unmatch flips status to UNMATCHED', async () => {
      const match = makeMatch();
      matchModel.findById.mockResolvedValue(match);
      petsService.findByIdAdmin
        .mockResolvedValueOnce(makePet({ _id: petId, owner: ownerId }))
        .mockResolvedValueOnce(
          makePet({ _id: otherPetId, owner: otherOwnerId }),
        );

      await service.unmatch(ownerId, matchId);

      expect(match.status).toBe(MatchStatus.UNMATCHED);
      expect(match.save).toHaveBeenCalled();
    });
  });

  describe('report', () => {
    it('throws NotFoundException for an unknown target pet', async () => {
      petsService.findByIdAdmin.mockResolvedValue(null);

      await expect(
        service.report(ownerId, { targetPetId: petId.toString(), reason: 'x' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when the target pet has no dating profile', async () => {
      petsService.findByIdAdmin.mockResolvedValue(makePet());
      profileModel.findOne.mockResolvedValue(null);

      await expect(
        service.report(ownerId, { targetPetId: petId.toString(), reason: 'x' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('creates a report and logs the action', async () => {
      petsService.findByIdAdmin.mockResolvedValue(makePet());
      profileModel.findOne.mockResolvedValue({ _id: new Types.ObjectId() });
      datingReportModel.create.mockResolvedValue({ _id: new Types.ObjectId() });

      await service.report(ownerId, {
        targetPetId: petId.toString(),
        reason: 'spam',
      });

      expect(datingReportModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ reason: 'spam' }),
      );
      expect(activityService.log).toHaveBeenCalledWith(
        ownerId,
        'dating.report.created',
        expect.any(String),
        expect.objectContaining({ targetPetId: petId.toString() }),
      );
    });
  });

  describe('admin methods', () => {
    const adminId = new Types.ObjectId().toString();

    it('adminUpdateReportStatus throws NotFoundException for an unknown report', async () => {
      datingReportModel.findByIdAndUpdate.mockResolvedValue(null);

      await expect(
        service.adminUpdateReportStatus(
          adminId,
          'missing',
          DatingReportStatus.REVIEWED,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('adminUpdateReportStatus stamps reviewedBy/reviewedAt and logs the action', async () => {
      datingReportModel.findByIdAndUpdate.mockResolvedValue({
        status: DatingReportStatus.ACTIONED,
      });

      await service.adminUpdateReportStatus(
        adminId,
        'report-1',
        DatingReportStatus.ACTIONED,
      );

      expect(activityService.log).toHaveBeenCalledWith(
        adminId,
        'dating.report.status-changed',
        'report-1',
        { status: DatingReportStatus.ACTIONED },
      );
    });

    it('adminDeactivateProfile throws NotFoundException for an unknown profile', async () => {
      profileModel.findOneAndUpdate.mockResolvedValue(null);

      await expect(
        service.adminDeactivateProfile('admin-1', petId.toString()),
      ).rejects.toThrow(NotFoundException);
    });

    it('adminDeactivateProfile sets isActive false and logs the action', async () => {
      profileModel.findOneAndUpdate.mockResolvedValue({ isActive: false });

      await service.adminDeactivateProfile('admin-1', petId.toString());

      expect(activityService.log).toHaveBeenCalledWith(
        'admin-1',
        'admin.dating-profile.deactivated',
        petId.toString(),
      );
    });
  });

  describe('cascade delete helpers', () => {
    it('deleteAllForPets skips the query entirely for an empty pet list', async () => {
      const result = await service.deleteAllForPets([]);

      expect(matchModel.find).not.toHaveBeenCalled();
      expect(profileModel.deleteMany).not.toHaveBeenCalled();
      expect(result).toEqual({ deletedCount: 0 });
    });

    it('deleteAllForPets cascades matches/messages/swipes/reports before the profile itself', async () => {
      const matchDoc = { _id: new Types.ObjectId() };
      matchModel.find.mockResolvedValue([matchDoc]);
      profileModel.deleteMany.mockResolvedValue({ deletedCount: 1 });

      const result = await service.deleteAllForPets([petId.toString()]);

      expect(messageModel.deleteMany).toHaveBeenCalledWith({
        matchId: { $in: [matchDoc._id] },
      });
      expect(matchModel.deleteMany).toHaveBeenCalledWith({
        _id: { $in: [matchDoc._id] },
      });
      expect(swipeModel.deleteMany).toHaveBeenCalled();
      expect(datingReportModel.deleteMany).toHaveBeenCalled();
      expect(profileModel.deleteMany).toHaveBeenCalled();
      expect(result).toEqual({ deletedCount: 1 });
    });

    it('deleteReportsByReporter deletes every report filed by this user', async () => {
      datingReportModel.deleteMany.mockResolvedValue({ deletedCount: 2 });

      const result = await service.deleteReportsByReporter(ownerId);

      expect(datingReportModel.deleteMany).toHaveBeenCalledWith({
        reporterUserId: new Types.ObjectId(ownerId),
      });
      expect(result).toEqual({ deletedCount: 2 });
    });
  });
});
