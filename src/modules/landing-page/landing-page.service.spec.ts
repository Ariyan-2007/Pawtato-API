import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';

import { LandingPageService } from './landing-page.service';
import { LandingPage } from './schemas/landing-page.schema';
import type { UpdateLandingPageDto } from './dto/update-landing-page.dto';
import { LandingPageSectionKey } from '../../common/enums/landing-page-section-key.enum';

describe('LandingPageService', () => {
  let service: LandingPageService;
  let landingPageModel: { findOneAndUpdate: jest.Mock };

  beforeEach(async () => {
    landingPageModel = { findOneAndUpdate: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LandingPageService,
        {
          provide: getModelToken(LandingPage.name),
          useValue: landingPageModel,
        },
      ],
    }).compile();

    service = module.get<LandingPageService>(LandingPageService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getPublicSections', () => {
    it('returns only enabled sections, sorted by order, with no enabled flag or internal fields', async () => {
      landingPageModel.findOneAndUpdate.mockResolvedValue({
        sections: [
          {
            key: LandingPageSectionKey.CTA,
            enabled: true,
            order: 2,
            content: { title: 'Ready?' },
          },
          {
            key: LandingPageSectionKey.TESTIMONIALS,
            enabled: false,
            order: 1,
            content: {},
          },
          {
            key: LandingPageSectionKey.HERO,
            enabled: true,
            order: 1,
            content: { title: 'Welcome' },
          },
        ],
      });

      const result = await service.getPublicSections();

      expect(result).toEqual([
        {
          key: LandingPageSectionKey.HERO,
          order: 1,
          content: { title: 'Welcome' },
        },
        {
          key: LandingPageSectionKey.CTA,
          order: 2,
          content: { title: 'Ready?' },
        },
      ]);
    });

    it('returns an empty array rather than throwing when there are no sections', async () => {
      landingPageModel.findOneAndUpdate.mockResolvedValue({ sections: [] });

      const result = await service.getPublicSections();

      expect(result).toEqual([]);
    });
  });

  describe('getAdminConfig', () => {
    it('returns every section, including disabled ones, sorted by order', async () => {
      const doc = {
        sections: [
          {
            key: LandingPageSectionKey.FAQ,
            enabled: false,
            order: 2,
            content: {},
          },
          {
            key: LandingPageSectionKey.HERO,
            enabled: true,
            order: 1,
            content: {},
          },
        ],
      };
      landingPageModel.findOneAndUpdate.mockResolvedValue(doc);

      const result = await service.getAdminConfig();

      expect(result.sections.map((section) => section.key)).toEqual([
        LandingPageSectionKey.HERO,
        LandingPageSectionKey.FAQ,
      ]);
    });
  });

  describe('replaceSections', () => {
    const validSections: UpdateLandingPageDto['sections'] = [
      {
        key: LandingPageSectionKey.HERO,
        enabled: true,
        order: 1,
        content: {},
      },
      {
        key: LandingPageSectionKey.CTA,
        enabled: true,
        order: 2,
        content: {},
      },
    ];

    it('rejects a payload with duplicate section keys', async () => {
      const dto: UpdateLandingPageDto = {
        sections: [
          {
            key: LandingPageSectionKey.HERO,
            enabled: true,
            order: 1,
            content: {},
          },
          {
            key: LandingPageSectionKey.HERO,
            enabled: true,
            order: 2,
            content: {},
          },
        ],
      };

      await expect(service.replaceSections(dto)).rejects.toThrow(
        BadRequestException,
      );

      expect(landingPageModel.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it('rejects a payload with duplicate order values', async () => {
      const dto: UpdateLandingPageDto = {
        sections: [
          {
            key: LandingPageSectionKey.HERO,
            enabled: true,
            order: 1,
            content: {},
          },
          {
            key: LandingPageSectionKey.CTA,
            enabled: true,
            order: 1,
            content: {},
          },
        ],
      };

      await expect(service.replaceSections(dto)).rejects.toThrow(
        BadRequestException,
      );

      expect(landingPageModel.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it('upserts a valid payload and returns it sorted by order', async () => {
      landingPageModel.findOneAndUpdate.mockResolvedValue({
        sections: [...validSections],
      });

      const result = await service.replaceSections({
        sections: validSections,
      });

      expect(landingPageModel.findOneAndUpdate).toHaveBeenCalledWith(
        {},
        { $set: { sections: validSections } },
        { upsert: true, new: true },
      );
      expect(result.sections).toHaveLength(2);
    });
  });

  describe('setSectionEnabled', () => {
    it('throws NotFoundException when no section has the given key', async () => {
      landingPageModel.findOneAndUpdate
        .mockResolvedValueOnce({ sections: [] }) // getOrCreateDocument
        .mockResolvedValueOnce(null); // the actual toggle update

      await expect(
        service.setSectionEnabled('not-a-real-key', true),
      ).rejects.toThrow(NotFoundException);
    });

    it('flips the enabled flag on the matching section', async () => {
      landingPageModel.findOneAndUpdate
        .mockResolvedValueOnce({ sections: [] }) // getOrCreateDocument
        .mockResolvedValueOnce({
          sections: [
            {
              key: LandingPageSectionKey.HERO,
              enabled: false,
              order: 1,
              content: {},
            },
          ],
        });

      const result = await service.setSectionEnabled(
        LandingPageSectionKey.HERO,
        false,
      );

      expect(landingPageModel.findOneAndUpdate).toHaveBeenLastCalledWith(
        { 'sections.key': LandingPageSectionKey.HERO },
        { $set: { 'sections.$.enabled': false } },
        { new: true },
      );
      expect(result.sections[0].enabled).toBe(false);
    });
  });
});
