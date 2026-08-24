import { Module } from '@nestjs/common';

import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

import { UsersModule } from '../users/users.module';
import { PetsModule } from '../pets/pets.module';
import { VaccinationsModule } from '../vaccinations/vaccinations.module';
import { MedicalModule } from '../medical/medical.module';
import { FoundReportsModule } from '../found-reports/found-reports.module';
import { ActivityModule } from '../activity/activity.module';

@Module({
  imports: [
    UsersModule,
    PetsModule,
    VaccinationsModule,
    MedicalModule,
    FoundReportsModule,
    ActivityModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
