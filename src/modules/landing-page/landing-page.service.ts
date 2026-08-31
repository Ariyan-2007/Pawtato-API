import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import {
  LandingPage,
  LandingPageDocument,
} from './schemas/landing-page.schema';
import { UpdateLandingPageDto } from './dto/update-landing-page.dto';
import { LandingPageSectionDto } from './dto/landing-page-section.dto';
import { DEFAULT_LANDING_PAGE_SECTIONS } from './landing-page.defaults';

@Injectable()
export class LandingPageService {
  constructor(
    @InjectModel(LandingPage.name)
    private readonly landingPageModel: Model<LandingPageDocument>,
  ) {}

  // The landing page is a singleton — exactly one document ever exists.
  // Upserting atomically here (rather than findOne then create) means two
  // concurrent first-reads after a fresh deploy can't race into creating two
  // documents, and it doubles as the "seed" step from the spec: there is no
  // separate seeding script in this project, so the first read after
  // deployment is what guarantees GET /landing-page returns a valid config
  // instead of 404ing or crashing.
  private async getOrCreateDocument(): Promise<LandingPageDocument> {
    const doc = await this.landingPageModel.findOneAndUpdate(
      {},
      { $setOnInsert: { sections: DEFAULT_LANDING_PAGE_SECTIONS } },
      { upsert: true, new: true },
    );

    return doc;
  }

  private sortByOrder<T extends { order: number }>(sections: T[]): T[] {
    return [...sections].sort((a, b) => a.order - b.order);
  }

  private validateSections(sections: LandingPageSectionDto[]): void {
    const seenKeys = new Set<string>();
    const seenOrders = new Set<number>();

    for (const section of sections) {
      if (seenKeys.has(section.key)) {
        throw new BadRequestException(`Duplicate section key: ${section.key}`);
      }
      seenKeys.add(section.key);

      if (seenOrders.has(section.order)) {
        throw new BadRequestException(
          `Duplicate section order value: ${section.order}`,
        );
      }
      seenOrders.add(section.order);
    }
  }

  // Public contract: only enabled sections, sorted, with no internal/admin
  // fields (no `enabled`, no Mongo `_id`/timestamps) — see
  // LandingPageController.getPublicLandingPage().
  async getPublicSections(): Promise<
    { key: string; order: number; content: Record<string, unknown> }[]
  > {
    const doc = await this.getOrCreateDocument();

    return this.sortByOrder(doc.sections)
      .filter((section) => section.enabled)
      .map((section) => ({
        key: section.key,
        order: section.order,
        content: section.content,
      }));
  }

  // Admin contract: every section, including disabled ones, so they can be
  // re-enabled from the same payload that was last saved.
  async getAdminConfig(): Promise<LandingPageDocument> {
    const doc = await this.getOrCreateDocument();

    doc.sections = this.sortByOrder(doc.sections);

    return doc;
  }

  async replaceSections(
    dto: UpdateLandingPageDto,
  ): Promise<LandingPageDocument> {
    this.validateSections(dto.sections);

    const doc = await this.landingPageModel.findOneAndUpdate(
      {},
      { $set: { sections: dto.sections } },
      { upsert: true, new: true },
    );

    doc.sections = this.sortByOrder(doc.sections);

    return doc;
  }

  async setSectionEnabled(
    key: string,
    enabled: boolean,
  ): Promise<LandingPageDocument> {
    await this.getOrCreateDocument();

    const filter: Record<string, unknown> = { 'sections.key': key };

    const doc = await this.landingPageModel.findOneAndUpdate(
      filter,
      { $set: { 'sections.$.enabled': enabled } },
      { new: true },
    );

    if (!doc) {
      throw new NotFoundException(`No landing-page section with key "${key}"`);
    }

    doc.sections = this.sortByOrder(doc.sections);

    return doc;
  }
}
