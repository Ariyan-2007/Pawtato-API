// The fixed set of section "kinds" the landing page frontend knows how to
// render. Content/copy/ordering/visibility are backend-driven (see
// LandingPageModule), but the *kind* of section is a code-level contract
// between backend and frontend renderers, so it stays a closed enum rather
// than an arbitrary string — adding a genuinely new section kind is a real
// (rare) code change on both sides, not a normal content update.
export enum LandingPageSectionKey {
  HERO = 'hero',
  FEATURES = 'features',
  HOW_IT_WORKS = 'how_it_works',
  STATS = 'stats',
  TESTIMONIALS = 'testimonials',
  FAQ = 'faq',
  CTA = 'cta',
  PROMO = 'promo',
}
