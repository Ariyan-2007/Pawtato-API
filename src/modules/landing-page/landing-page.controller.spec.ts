import { Test, TestingModule } from '@nestjs/testing';

import { LandingPageController } from './landing-page.controller';
import { LandingPageService } from './landing-page.service';
import { LandingPageSectionKey } from '../../common/enums/landing-page-section-key.enum';

describe('LandingPageController', () => {
  let controller: LandingPageController;
  let landingPageService: { getPublicSections: jest.Mock };

  beforeEach(async () => {
    landingPageService = { getPublicSections: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [LandingPageController],
      providers: [
        { provide: LandingPageService, useValue: landingPageService },
      ],
    }).compile();

    controller = module.get<LandingPageController>(LandingPageController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getPublicLandingPage', () => {
    it('wraps the enabled sections from the service in a `sections` envelope', async () => {
      const sections = [
        { key: LandingPageSectionKey.HERO, order: 1, content: { title: 'Hi' } },
      ];
      landingPageService.getPublicSections.mockResolvedValue(sections);

      const result = await controller.getPublicLandingPage();

      expect(landingPageService.getPublicSections).toHaveBeenCalled();
      expect(result).toEqual({ sections });
    });
  });
});
