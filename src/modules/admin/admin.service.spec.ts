import { Test, TestingModule } from '@nestjs/testing';
import { AdminService } from './admin.service';
import { UsersService } from '../users/users.service';
import { PetsService } from '../pets/pets.service';
import { VaccinationsService } from '../vaccinations/vaccinations.service';
import { MedicalService } from '../medical/medical.service';
import { FoundReportsService } from '../found-reports/found-reports.service';
import { ActivityService } from '../activity/activity.service';
import { UserRole } from '../../common/enums/user-role.enum';
import { FoundReportStatus } from '../../common/enums/found-report-status.enum';

describe('AdminService', () => {
  let service: AdminService;
  let usersService: {
    count: jest.Mock;
    blockUser: jest.Mock;
    unblockUser: jest.Mock;
    changeRole: jest.Mock;
    deleteUser: jest.Mock;
  };
  let petsService: {
    count: jest.Mock;
    countLost: jest.Mock;
    countRecovered: jest.Mock;
    recoverPet: jest.Mock;
    deletePet: jest.Mock;
  };
  let vaccinationsService: { count: jest.Mock };
  let medicalService: { count: jest.Mock };
  let foundReportsService: { findAllAdmin: jest.Mock; updateStatus: jest.Mock };
  let activityService: { log: jest.Mock };

  const actorId = 'admin-1';

  beforeEach(async () => {
    usersService = {
      count: jest.fn().mockResolvedValue(10),
      blockUser: jest.fn().mockResolvedValue({ blocked: true }),
      unblockUser: jest.fn().mockResolvedValue({ blocked: false }),
      changeRole: jest.fn().mockResolvedValue({ role: UserRole.ADMIN }),
      deleteUser: jest.fn().mockResolvedValue({ message: 'deleted' }),
    };
    petsService = {
      count: jest.fn().mockResolvedValue(5),
      countLost: jest.fn().mockResolvedValue(2),
      countRecovered: jest.fn().mockResolvedValue(3),
      recoverPet: jest.fn().mockResolvedValue({ isLost: false }),
      deletePet: jest.fn().mockResolvedValue({ message: 'deleted' }),
    };
    vaccinationsService = { count: jest.fn().mockResolvedValue(7) };
    medicalService = { count: jest.fn().mockResolvedValue(4) };
    foundReportsService = {
      findAllAdmin: jest.fn().mockResolvedValue({ foundReports: [] }),
      updateStatus: jest
        .fn()
        .mockResolvedValue({ status: FoundReportStatus.REVIEWED }),
    };
    activityService = { log: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: UsersService, useValue: usersService },
        { provide: PetsService, useValue: petsService },
        { provide: VaccinationsService, useValue: vaccinationsService },
        { provide: MedicalService, useValue: medicalService },
        { provide: FoundReportsService, useValue: foundReportsService },
        { provide: ActivityService, useValue: activityService },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('dashboard', () => {
    it('aggregates counts from every dependent service', async () => {
      const result = await service.dashboard();

      expect(result).toEqual({
        totalUsers: 10,
        totalPets: 5,
        lostPets: 2,
        recoveredPets: 3,
        totalVaccinations: 7,
        totalMedicalRecords: 4,
      });
    });
  });

  describe('user moderation delegation + audit logging', () => {
    it('block delegates to UsersService.blockUser and logs the action', async () => {
      await service.block(actorId, 'user-1');

      expect(usersService.blockUser).toHaveBeenCalledWith('user-1');
      expect(activityService.log).toHaveBeenCalledWith(
        actorId,
        'admin.user.blocked',
        'user-1',
      );
    });

    it('unblock delegates to UsersService.unblockUser and logs the action', async () => {
      await service.unblock(actorId, 'user-1');

      expect(usersService.unblockUser).toHaveBeenCalledWith('user-1');
      expect(activityService.log).toHaveBeenCalledWith(
        actorId,
        'admin.user.unblocked',
        'user-1',
      );
    });

    it('changeRole delegates to UsersService.changeRole and logs the new role', async () => {
      await service.changeRole(actorId, 'user-1', UserRole.ADMIN);

      expect(usersService.changeRole).toHaveBeenCalledWith(
        'user-1',
        UserRole.ADMIN,
      );
      expect(activityService.log).toHaveBeenCalledWith(
        actorId,
        'admin.user.role-changed',
        'user-1',
        { role: UserRole.ADMIN },
      );
    });

    it('delete delegates to UsersService.deleteUser and logs the action', async () => {
      await service.delete(actorId, 'user-1');

      expect(usersService.deleteUser).toHaveBeenCalledWith('user-1');
      expect(activityService.log).toHaveBeenCalledWith(
        actorId,
        'admin.user.deleted',
        'user-1',
      );
    });
  });

  describe('pet moderation delegation + audit logging', () => {
    it('recoverPet delegates to PetsService.recoverPet and logs the action', async () => {
      await service.recoverPet(actorId, 'pet-1');

      expect(petsService.recoverPet).toHaveBeenCalledWith('pet-1');
      expect(activityService.log).toHaveBeenCalledWith(
        actorId,
        'admin.pet.recovered',
        'pet-1',
      );
    });

    it('deletePet delegates to PetsService.deletePet and logs the action', async () => {
      await service.deletePet(actorId, 'pet-1');

      expect(petsService.deletePet).toHaveBeenCalledWith('pet-1');
      expect(activityService.log).toHaveBeenCalledWith(
        actorId,
        'admin.pet.deleted',
        'pet-1',
      );
    });
  });

  describe('found-report moderation delegation', () => {
    it('foundReports delegates to FoundReportsService.findAllAdmin', async () => {
      const query = { page: 1, limit: 10 };

      await service.foundReports(query);

      expect(foundReportsService.findAllAdmin).toHaveBeenCalledWith(query);
    });

    it('updateFoundReportStatus delegates to FoundReportsService.updateStatus (which logs its own audit entry)', async () => {
      await service.updateFoundReportStatus(
        actorId,
        'report-1',
        FoundReportStatus.DISMISSED,
      );

      expect(foundReportsService.updateStatus).toHaveBeenCalledWith(
        'report-1',
        actorId,
        FoundReportStatus.DISMISSED,
      );
    });
  });
});
