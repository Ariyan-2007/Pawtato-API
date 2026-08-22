import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import {
  Vaccination,
  VaccinationDocument,
} from '../../vaccinations/schemas/vaccination.schema';
import { Pet } from '../../pets/schemas/pet.schema';
import { User } from '../../users/schemas/user.schema';

import { NotificationsService } from '../notifications.service';

interface PopulatedVaccination extends Omit<VaccinationDocument, 'pet'> {
  pet: Pet & { owner: User };
}

@Injectable()
export class VaccinationReminderJob {
  private readonly logger = new Logger(VaccinationReminderJob.name);

  constructor(
    @InjectModel(Vaccination.name)
    private readonly vaccinationModel: Model<VaccinationDocument>,

    private readonly notificationsService: NotificationsService,
  ) {}

  @Cron('0 9 * * *')
  async handleCron() {
    this.logger.log('Checking upcoming vaccinations...');

    const today = new Date();

    const nextWeek = new Date();
    nextWeek.setDate(today.getDate() + 7);

    const vaccinations = (await this.vaccinationModel
      .find({
        reminderSent: false,
        nextDueDate: {
          $gte: today,
          $lte: nextWeek,
        },
      })
      .populate({
        path: 'pet',
        populate: { path: 'owner' },
      })) as unknown as PopulatedVaccination[];

    this.logger.log(`Found ${vaccinations.length} upcoming vaccinations.`);

    for (const vaccination of vaccinations) {
      const ownerEmail = vaccination.pet?.owner?.email;

      if (!ownerEmail) {
        this.logger.warn(
          `Skipping reminder for vaccination ${String(vaccination._id)}: no owner email found.`,
        );
        continue;
      }

      await this.notificationsService.sendEmail(
        ownerEmail,
        'Vaccination Reminder',
        `Your pet's vaccination "${vaccination.vaccineName}" is due on ${vaccination.nextDueDate.toDateString()}.`,
      );

      vaccination.reminderSent = true;
      vaccination.lastReminderSentAt = new Date();

      await vaccination.save();

      this.logger.log(`Reminder sent for vaccine: ${vaccination.vaccineName}`);
    }
  }
}
