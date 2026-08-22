import { Test, TestingModule } from '@nestjs/testing';
import { AdminService } from './admin.service';
import { UsersService } from '../users/users.service';
import { PetsService } from '../pets/pets.service';
import { VaccinationsService } from '../vaccinations/vaccinations.service';
import { MedicalService } from '../medical/medical.service';

describe('AdminService', () => {
  let service: AdminService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: UsersService, useValue: {} },
        { provide: PetsService, useValue: {} },
        { provide: VaccinationsService, useValue: {} },
        { provide: MedicalService, useValue: {} },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
