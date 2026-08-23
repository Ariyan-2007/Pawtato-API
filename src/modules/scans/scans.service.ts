import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Model, Types } from 'mongoose';

import { ScanEvent, ScanEventDocument } from './schemas/scan-event.schema';
import { PetsService } from '../pets/pets.service';
import { DOMAIN_EVENTS } from '../../common/events/domain-events';
import { User } from '../users/schemas/user.schema';

@Injectable()
export class ScansService {
  private readonly logger = new Logger(ScansService.name);

  constructor(
    @InjectModel(ScanEvent.name)
    private readonly scanEventModel: Model<ScanEventDocument>,

    private readonly petsService: PetsService,

    private readonly eventEmitter: EventEmitter2,
  ) {}

  async record(
    tagId: Types.ObjectId,
    petId: Types.ObjectId | null,
    publicCode: string,
    userAgent?: string,
  ) {
    const scanEvent = await this.scanEventModel.create({
      tag: tagId,
      pet: petId,
      userAgent,
    });

    if (petId) {
      await this.emitScannedEvent(tagId, petId, publicCode);
    }

    return scanEvent;
  }

  // Best-effort: an owner-lookup failure here must never fail the public scan request.
  private async emitScannedEvent(
    tagId: Types.ObjectId,
    petId: Types.ObjectId,
    publicCode: string,
  ) {
    try {
      const pet = await this.petsService.findWithOwner(petId.toString());
      const owner = pet?.owner as unknown as
        (User & { _id?: Types.ObjectId }) | undefined;

      if (!pet || !owner?._id) {
        return;
      }

      this.eventEmitter.emit(DOMAIN_EVENTS.QR_TAG_SCANNED, {
        ownerId: String(owner._id),
        tagId: tagId.toString(),
        publicCode,
        petId: petId.toString(),
        petName: pet.name,
        isLost: pet.isLost,
      });
    } catch (error) {
      this.logger.error(
        `Failed to emit qr.tag-scanned for tag ${tagId.toString()}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  async findForOwnedPet(ownerId: string, petId: string) {
    await this.petsService.findOwnedPet(ownerId, petId);

    return this.scanEventModel.find({ pet: petId }).sort({ createdAt: -1 });
  }
}
