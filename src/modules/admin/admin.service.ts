import { Injectable } from '@nestjs/common';

import { UsersService } from '../users/users.service';
import { PetsService } from '../pets/pets.service';
import { VaccinationsService } from '../vaccinations/vaccinations.service';
import { MedicalService } from '../medical/medical.service';

import { DashboardStatsDto } from './dto/dashboard-stats.dto';

@Injectable()
export class AdminService {
  constructor(
    private readonly usersService: UsersService,
    private readonly petsService: PetsService,
    private readonly vaccinationsService: VaccinationsService,
    private readonly medicalService: MedicalService,
  ) {}

  async dashboard(): Promise<DashboardStatsDto> {
  return {
    totalUsers: await this.usersService.count(),

    totalPets: await this.petsService.count(),

    lostPets: await this.petsService.countLost(),

    recoveredPets: await this.petsService.countRecovered(),

    totalVaccinations:
      await this.vaccinationsService.count(),

    totalMedicalRecords:
      await this.medicalService.count(),
   };
  }
}