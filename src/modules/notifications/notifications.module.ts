import { Module } from '@nestjs/common';
import { MailerModule } from '@nestjs-modules/mailer';

import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

import { VaccinationReminderJob } from './jobs/vaccination-reminder.job';

@Module({
  imports: [
    MailerModule.forRoot({
      transport: {
        host: process.env.MAIL_HOST,
        port: Number(process.env.MAIL_PORT),
        secure: false,
        auth: {
          user: process.env.MAIL_USER,
          pass: process.env.MAIL_PASSWORD,
        },
      },

      defaults: {
        from: process.env.MAIL_FROM,
      },
    }),
  ],

  controllers: [NotificationsController],

  providers: [
    NotificationsService,
    VaccinationReminderJob,
  ],

  exports: [NotificationsService],
})
export class NotificationsModule {}