import { LandingPageSectionKey } from '../../common/enums/landing-page-section-key.enum';
import { LandingPageSection } from './schemas/landing-page.schema';

// Seeded once, lazily, the first time the landing page is read and no
// document exists yet (see LandingPageService.getOrCreateDocument) — this
// project has no separate seeding script/CLI, so an upsert-on-first-read is
// the least-new-machinery way to guarantee GET /landing-page never 404s or
// crashes on a fresh deployment. Deliberately minimal placeholder copy, not
// real marketing content — an admin is expected to fill this in for real via
// PUT /admin/landing-page.
export const DEFAULT_LANDING_PAGE_SECTIONS: LandingPageSection[] = [
  {
    key: LandingPageSectionKey.HERO,
    enabled: true,
    order: 1,
    content: {
      title: 'Give Your Pet a Better Life',
      subtitle: 'Digital ID tags for pets — scan, identify, reunite.',
      primaryCta: { text: 'Get Started', url: '/signup' },
    },
  },
  {
    key: LandingPageSectionKey.FEATURES,
    enabled: true,
    order: 2,
    content: {
      title: 'Everything Your Pet Needs',
      items: [],
    },
  },
  {
    key: LandingPageSectionKey.HOW_IT_WORKS,
    enabled: true,
    order: 3,
    content: {
      title: 'How It Works',
      items: [],
    },
  },
  {
    key: LandingPageSectionKey.TESTIMONIALS,
    enabled: false,
    order: 4,
    content: {
      title: 'Loved by Pet Owners',
      testimonials: [],
    },
  },
  {
    key: LandingPageSectionKey.FAQ,
    enabled: false,
    order: 5,
    content: {
      title: 'Frequently Asked Questions',
      faqs: [],
    },
  },
  {
    key: LandingPageSectionKey.CTA,
    enabled: true,
    order: 6,
    content: {
      title: 'Ready to protect your pet?',
      primaryCta: { text: 'Get Started', url: '/signup' },
    },
  },
] as LandingPageSection[];
