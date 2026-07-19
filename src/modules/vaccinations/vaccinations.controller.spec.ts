import { Test, TestingModule } from '@nestjs/testing';
import { VaccinationsController } from './vaccinations.controller';

describe('VaccinationsController', () => {
  let controller: VaccinationsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [VaccinationsController],
    }).compile();

    controller = module.get<VaccinationsController>(VaccinationsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
