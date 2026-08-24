import { Test, TestingModule } from '@nestjs/testing';
import { AdminService } from './admin.service';
import { UsersService } from '../users/users.service';
import { PetsService } from '../pets/pets.service';
import { VaccinationsService } from '../vaccinations/vaccinations.service';
import { MedicalService } from '../medical/medical.service';
import { UserRole } from '../../common/enums/user-role.enum';

describe('AdminService', () => {
  let service: AdminService;
  let usersService: {
    count: jest.Mock;
    blockUser: jest.Mock;
    changeRole: jest.Mock;
  };
  let petsService: {
    count: jest.Mock;
    countLost: jest.Mock;
    countRecovered: jest.Mock;
  };
  let vaccinationsService: { count: jest.Mock };
  let medicalService: { count: jest.Mock };

  beforeEach(async () => {
    usersService = {
      count: jest.fn().mockResolvedValue(10),
      blockUser: jest.fn(),
      changeRole: jest.fn(),
    };
    petsService = {
      count: jest.fn().mockResolvedValue(5),
      countLost: jest.fn().mockResolvedValue(2),
      countRecovered: jest.fn().mockResolvedValue(3),
    };
    vaccinationsService = { count: jest.fn().mockResolvedValue(7) };
    medicalService = { count: jest.fn().mockResolvedValue(4) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: UsersService, useValue: usersService },
        { provide: PetsService, useValue: petsService },
        { provide: VaccinationsService, useValue: vaccinationsService },
        { provide: MedicalService, useValue: medicalService },
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

  describe('user moderation delegation', () => {
    it('block delegates to UsersService.blockUser', async () => {
      await service.block('user-1');

      expect(usersService.blockUser).toHaveBeenCalledWith('user-1');
    });

    it('changeRole delegates to UsersService.changeRole', async () => {
      await service.changeRole('user-1', UserRole.ADMIN);

      expect(usersService.changeRole).toHaveBeenCalledWith(
        'user-1',
        UserRole.ADMIN,
      );
    });
  });
});
