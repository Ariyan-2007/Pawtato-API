import { Test, TestingModule } from '@nestjs/testing';
import { VaccinationsController } from './vaccinations.controller';
import { VaccinationsService } from './vaccinations.service';

describe('VaccinationsController', () => {
  let controller: VaccinationsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [VaccinationsController],
      providers: [{ provide: VaccinationsService, useValue: {} }],
    }).compile();

    controller = module.get<VaccinationsController>(VaccinationsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
