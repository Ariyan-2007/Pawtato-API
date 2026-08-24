import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';

import configuration from './config/configuration';
import { envValidationSchema } from './config/env.validation';
import { DatabaseModule } from './modules/database/database.module';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { PetsModule } from './modules/pets/pets.module';
import { PublicModule } from './modules/public/public.module';
import { QrModule } from './modules/qr/qr.module';
import { TagsModule } from './modules/tags/tags.module';
import { ScansModule } from './modules/scans/scans.module';
import { FoundReportsModule } from './modules/found-reports/found-reports.module';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { MedicalModule } from './modules/medical/medical.module';
import { VaccinationsModule } from './modules/vaccinations/vaccinations.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ScheduleModule } from '@nestjs/schedule';
import { AdminModule } from './modules/admin/admin.module';
import { ActivityModule } from './modules/activity/activity.module';
import { StorageModule } from './modules/storage/storage.module';
import { DatingModule } from './modules/dating/dating.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: '.env',
      validationSchema: envValidationSchema,
      validationOptions: {
        abortEarly: false,
      },
    }),
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'uploads'),
      serveRoot: '/uploads',
    }),
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),

    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60_000,
        limit: 100,
      },
      {
        name: 'public',
        ttl: 60_000,
        limit: 20,
      },
      {
        name: 'write',
        ttl: 60_000,
        limit: 5,
      },
      {
        name: 'swipe',
        ttl: 60_000,
        limit: 60,
      },
    ]),

    StorageModule,

    DatabaseModule,

    HealthModule,

    AuthModule,

    UsersModule,

    PetsModule,

    PublicModule,

    QrModule,

    TagsModule,

    ScansModule,

    FoundReportsModule,

    MedicalModule,

    VaccinationsModule,

    NotificationsModule,

    AdminModule,

    ActivityModule,

    DatingModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
