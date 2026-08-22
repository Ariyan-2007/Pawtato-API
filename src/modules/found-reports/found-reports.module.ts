import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { FoundReportsController } from './found-reports.controller';
import { FoundReportsService } from './found-reports.service';
import { FoundReport, FoundReportSchema } from './schemas/found-report.schema';

import { TagsModule } from '../tags/tags.module';
import { PetsModule } from '../pets/pets.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: FoundReport.name,
        schema: FoundReportSchema,
      },
    ]),

    TagsModule,
    PetsModule,
    NotificationsModule,
  ],

  controllers: [FoundReportsController],

  providers: [FoundReportsService],

  exports: [FoundReportsService],
})
export class FoundReportsModule {}
