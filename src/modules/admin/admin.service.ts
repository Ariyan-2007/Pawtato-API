import { Injectable } from '@nestjs/common';

import { UsersService } from '../users/users.service';
import { PetsService } from '../pets/pets.service';
import { VaccinationsService } from '../vaccinations/vaccinations.service';
import { MedicalService } from '../medical/medical.service';

import { DashboardStatsDto } from './dto/dashboard-stats.dto';
import { AdminUserQueryDto } from './dto/admin-user-query.dto';

import { UserRole } from '../../common/enums/user-role.enum';

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

  async users(
    query: AdminUserQueryDto,
  ) {
    return this.usersService.findAll(query);
  }

  async user(id: string) {
    return this.usersService.findById(id);
  }

  async block(id: string) {
    return this.usersService.blockUser(id);
  }

  async unblock(id: string) {
    return this.usersService.unblockUser(id);
  }

  async changeRole(
    id: string,
    role: UserRole,
  ) {
    return this.usersService.changeRole(
      id,
      role,
    );
  }

  async delete(id: string) {
    return this.usersService.deleteUser(id);
  }
}