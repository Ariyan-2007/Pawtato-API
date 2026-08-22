import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { Pet, PetDocument } from '../pets/schemas/pet.schema';
import { Tag, TagDocument } from '../tags/schemas/tag.schema';
import { TagStatus } from '../../common/enums/tag-status.enum';
import { ScansService } from '../scans/scans.service';
import { FoundReportsService } from '../found-reports/found-reports.service';
import { CreateFoundReportDto } from '../found-reports/dto/create-found-report.dto';

@Injectable()
export class PublicService {
  constructor(
    @InjectModel(Pet.name)
    private readonly petModel: Model<PetDocument>,

    @InjectModel(Tag.name)
    private readonly tagModel: Model<TagDocument>,

    private readonly scansService: ScansService,
    private readonly foundReportsService: FoundReportsService,
  ) {}

  async getPetProfile(publicCode: string, userAgent?: string) {
    const tag = await this.tagModel.findOne({ publicCode });

    if (!tag) {
      throw new NotFoundException('Tag not found');
    }

    if (tag.status === TagStatus.RETIRED) {
      await this.scansService.record(tag._id, null, userAgent);

      return {
        tagStatus: TagStatus.RETIRED,
        message: 'This tag has been retired and is no longer in use.',
      };
    }

    if (tag.status === TagStatus.SUSPENDED) {
      await this.scansService.record(tag._id, null, userAgent);

      return {
        tagStatus: TagStatus.SUSPENDED,
        message: 'This tag has been suspended.',
      };
    }

    if (tag.status !== TagStatus.ASSIGNED || !tag.assignedPetId) {
      await this.scansService.record(tag._id, null, userAgent);

      return {
        tagStatus: tag.status,
        message: 'This tag has not been linked to a pet yet.',
      };
    }

    const pet = await this.petModel.findByIdAndUpdate(
      tag.assignedPetId,
      {
        $inc: { scanCount: 1 },
        lastScannedAt: new Date(),
      },
      { new: true },
    );

    if (!pet) {
      throw new NotFoundException('Pet not found');
    }

    await this.scansService.record(tag._id, tag.assignedPetId, userAgent);

    return {
      tagStatus: TagStatus.ASSIGNED,
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

  async getLostPets() {
    const pets = await this.petModel
      .find({ isLost: true })
      .select(
        'name species breed profileImage lastSeenLocation reward lostDate',
      )
      .sort({ lostDate: -1 })
      .lean();

    const petIds = pets.map((pet) => pet._id);

    const tags = await this.tagModel
      .find({
        assignedPetId: { $in: petIds },
        status: TagStatus.ASSIGNED,
      })
      .select('assignedPetId publicCode')
      .lean();

    const publicCodeByPetId = new Map(
      tags.map((tag) => [String(tag.assignedPetId), tag.publicCode]),
    );

    return pets.map((pet) => ({
      publicCode: publicCodeByPetId.get(String(pet._id)) ?? null,
      name: pet.name,
      species: pet.species,
      breed: pet.breed,
      profileImage: pet.profileImage,
      lastSeenLocation: pet.lastSeenLocation,
      reward: pet.reward,
      lostDate: pet.lostDate,
    }));
  }

  async submitFoundReport(
    publicCode: string,
    dto: CreateFoundReportDto,
    photoUrl?: string,
  ) {
    // Deliberately don't return the raw FoundReport doc — it carries the pet's
    // and tag's internal Mongo IDs, which the public API must never expose.
    await this.foundReportsService.create(publicCode, dto, photoUrl);

    return {
      message: 'Thanks — the owner has been notified.',
    };
  }
}
