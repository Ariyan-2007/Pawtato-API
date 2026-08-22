import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import {
  FoundReport,
  FoundReportDocument,
} from './schemas/found-report.schema';
import { CreateFoundReportDto } from './dto/create-found-report.dto';
import { TagsService } from '../tags/tags.service';
import { PetsService } from '../pets/pets.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TagStatus } from '../../common/enums/tag-status.enum';
import { User } from '../users/schemas/user.schema';
import { PetDocument } from '../pets/schemas/pet.schema';

interface PetWithOwner extends Omit<PetDocument, 'owner'> {
  owner: User;
}

@Injectable()
export class FoundReportsService {
  private readonly logger = new Logger(FoundReportsService.name);

  constructor(
    @InjectModel(FoundReport.name)
    private readonly foundReportModel: Model<FoundReportDocument>,

    private readonly tagsService: TagsService,
    private readonly petsService: PetsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(
    publicCode: string,
    dto: CreateFoundReportDto,
    photoUrl?: string,
  ) {
    const tag = await this.tagsService.findByPublicCode(publicCode);

    if (tag.status !== TagStatus.ASSIGNED || !tag.assignedPetId) {
      throw new BadRequestException(
        'This tag is not currently linked to a pet',
      );
    }

    const report = await this.foundReportModel.create({
      tag: tag._id,
      pet: tag.assignedPetId,
      message: dto.message,
      approxLocation: dto.approxLocation,
      contactInfo: dto.contactInfo,
      photoUrl,
    });

    // The report is already saved at this point — a failed notification must
    // never turn into a failure response for a finder who already succeeded.
    await this.notifyOwner(tag.assignedPetId.toString(), report);

    return report;
  }

  private async notifyOwner(petId: string, report: FoundReportDocument) {
    try {
      const pet = (await this.petsService.findWithOwner(
        petId,
      )) as PetWithOwner | null;

      const ownerEmail = pet?.owner?.email;

      if (!pet || !ownerEmail) {
        return;
      }

      await this.notificationsService.sendEmail(
        ownerEmail,
        `Someone may have found ${pet.name}!`,
        report.message,
      );
    } catch (error) {
      this.logger.error(
        `Failed to notify owner for found report ${String(report._id)}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  async findForOwnedPet(ownerId: string, petId: string) {
    await this.petsService.findOwnedPet(ownerId, petId);

    return this.foundReportModel.find({ pet: petId }).sort({ createdAt: -1 });
  }
}
