import { Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { PetsService } from '../pets/pets.service';
import { VaccinationsService } from '../vaccinations/vaccinations.service';
import { MedicalService } from '../medical/medical.service';
import { FoundReportsService } from '../found-reports/found-reports.service';
import { ActivityService } from '../activity/activity.service';
import { DashboardStatsDto } from './dto/dashboard-stats.dto';
import { AdminUserQueryDto } from './dto/admin-user-query.dto';
import { UserRole } from '../../common/enums/user-role.enum';
import { AdminPetQueryDto } from './dto/admin-pet-query.dto';
import { AdminFoundReportQueryDto } from './dto/admin-found-report-query.dto';
import { FoundReportStatus } from '../../common/enums/found-report-status.enum';

@Injectable()
export class AdminService {
  constructor(
    private readonly usersService: UsersService,
    private readonly petsService: PetsService,
    private readonly vaccinationsService: VaccinationsService,
    private readonly medicalService: MedicalService,
    private readonly foundReportsService: FoundReportsService,
    private readonly activityService: ActivityService,
  ) {}

  async dashboard(): Promise<DashboardStatsDto> {
    return {
      totalUsers: await this.usersService.count(),

      totalPets: await this.petsService.count(),

      lostPets: await this.petsService.countLost(),

      recoveredPets: await this.petsService.countRecovered(),

      totalVaccinations: await this.vaccinationsService.count(),

      totalMedicalRecords: await this.medicalService.count(),
    };
  }

  async users(query: AdminUserQueryDto) {
    return this.usersService.findAll(query);
  }

  async user(id: string) {
    return this.usersService.findById(id);
  }

  async block(actorId: string, id: string) {
    const result = await this.usersService.blockUser(id);

    await this.activityService.log(actorId, 'admin.user.blocked', id);

    return result;
  }

  async unblock(actorId: string, id: string) {
    const result = await this.usersService.unblockUser(id);

    await this.activityService.log(actorId, 'admin.user.unblocked', id);

    return result;
  }

  async changeRole(actorId: string, id: string, role: UserRole) {
    const result = await this.usersService.changeRole(id, role);

    await this.activityService.log(actorId, 'admin.user.role-changed', id, {
      role,
    });

    return result;
  }

  async delete(actorId: string, id: string) {
    const result = await this.usersService.deleteUser(id);

    await this.activityService.log(actorId, 'admin.user.deleted', id);

    return result;
  }

  async pets(query: AdminPetQueryDto) {
    return this.petsService.findAllAdmin(query);
  }

  async pet(id: string) {
    return this.petsService.findByIdAdmin(id);
  }

  async recoverPet(actorId: string, id: string) {
    const result = await this.petsService.recoverPet(id);

    await this.activityService.log(actorId, 'admin.pet.recovered', id);

    return result;
  }

  async deletePet(actorId: string, id: string) {
    const result = await this.petsService.deletePet(id);

    await this.activityService.log(actorId, 'admin.pet.deleted', id);

    return result;
  }

  async analytics() {
    return {
      monthlyUsers: await this.usersService.monthlyRegistrations(),

      monthlyPets: await this.petsService.monthlyRegistrations(),

      speciesDistribution: await this.petsService.speciesDistribution(),

      lostVsRecovered: {
        lost: await this.petsService.countLost(),

        recovered: await this.petsService.countRecovered(),
      },

      topScannedPets: await this.petsService.topScannedPets(),
    };
  }

  async foundReports(query: AdminFoundReportQueryDto) {
    return this.foundReportsService.findAllAdmin(query);
  }

  async updateFoundReportStatus(
    actorId: string,
    id: string,
    status: FoundReportStatus,
  ) {
    return this.foundReportsService.updateStatus(id, actorId, status);
  }
}
