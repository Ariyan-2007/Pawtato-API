import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MailerModule } from '@nestjs-modules/mailer';

import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { VaccinationReminderJob } from './jobs/vaccination-reminder.job';

import { VaccinationsModule } from '../vaccinations/vaccinations.module';

@Module({
  imports: [
    VaccinationsModule,

    MailerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        transport: {
          host: configService.get<string>('mail.host'),
          port: configService.get<number>('mail.port'),
          secure: false,
          auth: {
            user: configService.get<string>('mail.user'),
            pass: configService.get<string>('mail.password'),
          },
        },
        defaults: {
          from: configService.get<string>('mail.from'),
        },
      }),
    }),
  ],

  controllers: [NotificationsController],

  providers: [NotificationsService, VaccinationReminderJob],

  exports: [NotificationsService],
})
export class NotificationsModule {}
