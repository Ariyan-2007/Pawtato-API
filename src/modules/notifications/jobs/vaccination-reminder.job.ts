import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import {
  Vaccination,
  VaccinationDocument,
} from '../../vaccinations/schemas/vaccination.schema';

import { NotificationsService } from '../notifications.service';

@Injectable()
export class VaccinationReminderJob {
  private readonly logger = new Logger(
    VaccinationReminderJob.name,
  );

  constructor(
    @InjectModel(Vaccination.name)
    private readonly vaccinationModel: Model<VaccinationDocument>,

    private readonly notificationsService: NotificationsService,
  ) {}

  // Change to @Cron('0 9 * * *') when finished testing
  @Cron('*/15 * * * * *')
  async handleCron() {
    this.logger.log('Checking upcoming vaccinations...');

    const today = new Date();

    const nextWeek = new Date();
    nextWeek.setDate(today.getDate() + 7);

    const vaccinations = await this.vaccinationModel.find({
      reminderSent: false,
      nextDueDate: {
        $gte: today,
        $lte: nextWeek,
      },
    });

    this.logger.log(
      `Found ${vaccinations.length} upcoming vaccinations.`,
    );

    for (const vaccination of vaccinations) {
      this.notificationsService.sendEmail(
        'demo@pawtato.com',
        'Vaccination Reminder',
        `Your pet vaccination "${vaccination.vaccineName}" is due on ${vaccination.nextDueDate.toDateString()}.`,
      );

      vaccination.reminderSent = true;
      vaccination.lastReminderSentAt = new Date();

      await vaccination.save();

      this.logger.log(
        `Reminder sent for vaccine: ${vaccination.vaccineName}`,
      );
    }
  }
}