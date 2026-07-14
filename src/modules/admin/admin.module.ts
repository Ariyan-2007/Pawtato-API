import { Module } from '@nestjs/common';

import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

import { UsersModule } from '../users/users.module';
import { PetsModule } from '../pets/pets.module';
import { VaccinationsModule } from '../vaccinations/vaccinations.module';
import { MedicalModule } from '../medical/medical.module';

@Module({
  imports: [
    UsersModule,
    PetsModule,
    VaccinationsModule,
    MedicalModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}