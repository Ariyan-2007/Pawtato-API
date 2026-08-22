import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { nanoid } from 'nanoid';

import { Tag, TagDocument } from './schemas/tag.schema';
import { CreateTagDto } from './dto/create-tag.dto';
import { AssignTagDto } from './dto/assign-tag.dto';
import { UnassignTagDto } from './dto/unassign-tag.dto';
import { TagQueryDto } from './dto/tag-query.dto';
import { TagStatus } from '../../common/enums/tag-status.enum';
import { PetsService } from '../pets/pets.service';
import { QrService } from '../qr/qr.service';

@Injectable()
export class TagsService {
  constructor(
    @InjectModel(Tag.name)
    private readonly tagModel: Model<TagDocument>,

    private readonly petsService: PetsService,
    private readonly qrService: QrService,
  ) {}

  async create(dto: CreateTagDto) {
    const publicCode = nanoid(10);
    const serialNumber = dto.serialNumber?.trim() || nanoid(12);

    const qrImageUrl = await this.qrService.generate(publicCode);

    return this.tagModel.create({
      publicCode,
      serialNumber,
      status: TagStatus.AVAILABLE,
      qrImageUrl,
    });
  }

  async findAll(query: TagQueryDto) {
    const { page, limit, status } = query;

    const filter = status ? { status } : {};

    const total = await this.tagModel.countDocuments(filter);

    const tags = await this.tagModel
      .find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    return {
      tags,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findMine(ownerId: string) {
    const pets = await this.petsService.findAll(ownerId);
    const petIds = pets.map((pet) => pet._id);

    return this.tagModel.find({
      assignedPetId: { $in: petIds },
      status: TagStatus.ASSIGNED,
    });
  }

  async findOne(id: string) {
    const tag = await this.tagModel.findById(id);

    if (!tag) {
      throw new NotFoundException('Tag not found');
    }

    return tag;
  }

  async findByPublicCode(publicCode: string) {
    const tag = await this.tagModel.findOne({ publicCode });

    if (!tag) {
      throw new NotFoundException('Tag not found');
    }

    return tag;
  }

  async assign(ownerId: string, dto: AssignTagDto) {
    const tag = await this.tagModel.findOne({ publicCode: dto.publicCode });

    if (!tag) {
      throw new NotFoundException('Tag not found');
    }

    if (tag.status !== TagStatus.AVAILABLE) {
      throw new BadRequestException('This tag is not available for assignment');
    }

    const pet = await this.petsService.findOwnedPet(ownerId, dto.petId);

    const existingActiveTag = await this.tagModel.findOne({
      assignedPetId: pet._id,
      status: TagStatus.ASSIGNED,
    });

    if (existingActiveTag) {
      throw new BadRequestException(
        'This pet already has an active tag. Unassign it before assigning a new one.',
      );
    }

    tag.status = TagStatus.ASSIGNED;
    tag.assignedPetId = pet._id;
    tag.assignedAt = new Date();
    tag.unassignedAt = undefined;

    await tag.save();

    return tag;
  }

  async unassign(ownerId: string, dto: UnassignTagDto, isAdmin: boolean) {
    const tag = await this.tagModel.findOne({ publicCode: dto.publicCode });

    if (!tag) {
      throw new NotFoundException('Tag not found');
    }

    if (tag.status !== TagStatus.ASSIGNED || !tag.assignedPetId) {
      throw new BadRequestException(
        'This tag is not currently assigned to a pet',
      );
    }

    if (!isAdmin) {
      await this.petsService.findOwnedPet(
        ownerId,
        tag.assignedPetId.toString(),
      );
    }

    tag.status = TagStatus.AVAILABLE;
    tag.assignedPetId = null;
    tag.unassignedAt = new Date();

    await tag.save();

    return tag;
  }

  async suspend(id: string) {
    const tag = await this.findOne(id);

    if (tag.status === TagStatus.RETIRED) {
      throw new BadRequestException('A retired tag cannot be suspended');
    }

    tag.status = TagStatus.SUSPENDED;

    await tag.save();

    return tag;
  }

  async retire(id: string) {
    const tag = await this.findOne(id);

    tag.status = TagStatus.RETIRED;
    tag.assignedPetId = null;

    await tag.save();

    return tag;
  }
}
