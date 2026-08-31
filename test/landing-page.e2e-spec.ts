import { INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { MailerService } from '@nestjs-modules/mailer';
import request from 'supertest';
import type { Response } from 'supertest';
import type { App } from 'supertest/types';
import type { Model } from 'mongoose';

import { createTestApp } from './test-app';
import { User, UserDocument } from '../src/modules/users/schemas/user.schema';
import { UserRole } from '../src/common/enums/user-role.enum';

interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

function data<T>(res: Response): T {
  return (res.body as ApiEnvelope<T>).data;
}

interface PublicSection {
  key: string;
  order: number;
  content: Record<string, unknown>;
}

interface AdminSection extends PublicSection {
  enabled: boolean;
}

// Covers the dynamic landing-page config API end-to-end: the public GET is
// unauthenticated and only ever returns enabled sections in order, while the
// admin GET/PUT/PATCH surface (gated the same way every other admin route in
// this API is gated — JwtAuthGuard + RolesGuard(ADMIN)) is what a non-admin
// must never be able to reach.
describe('Landing page (e2e)', () => {
  let app: INestApplication<App>;
  let userModel: Model<UserDocument>;
  let capturedOtp: string | undefined;

  const runId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const password = 'StrongPass123';
  const adminEmail = `landing-page-admin-${runId}@example.com`;
  const userEmail = `landing-page-user-${runId}@example.com`;

  let adminAccessToken: string;
  let userAccessToken: string;

  async function registerAndVerify(fullName: string, email: string) {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ fullName, email, password })
      .expect(201);

    const verifyRes = await request(app.getHttpServer())
      .post('/api/auth/verify-otp')
      .send({ email, otp: capturedOtp })
      .expect(200);

    return data<{ accessToken: string; user: { id: string } }>(verifyRes);
  }

  beforeAll(async () => {
    const mailerService = {
      sendMail: jest.fn((options: { context?: Record<string, unknown> }) => {
        const otp = options.context?.otp;

        if (typeof otp === 'string') {
          capturedOtp = otp;
        }

        return Promise.resolve();
      }),
    };

    app = await createTestApp((builder) =>
      builder.overrideProvider(MailerService).useValue(mailerService),
    );

    userModel = app.get<Model<UserDocument>>(getModelToken(User.name));

    const { user } = await registerAndVerify('Landing Admin', adminEmail);
    await userModel.findByIdAndUpdate(user.id, { role: UserRole.ADMIN });

    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: adminEmail, password })
      .expect(200);
    adminAccessToken = data<{ accessToken: string }>(loginRes).accessToken;

    const regular = await registerAndVerify('Landing User', userEmail);
    userAccessToken = regular.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('is publicly readable with no auth and auto-seeds a default config on first read', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/landing-page')
      .expect(200);

    const { sections } = data<{ sections: PublicSection[] }>(res);

    expect(sections.length).toBeGreaterThan(0);
    // Public payload only ever contains what the frontend needs to render —
    // no `enabled` flag (everything returned is implicitly enabled) and no
    // Mongo-internal fields.
    for (const section of sections) {
      expect(Object.keys(section).sort()).toEqual(['content', 'key', 'order']);
    }
  });

  it('returns sections already sorted by order', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/landing-page')
      .expect(200);

    const { sections } = data<{ sections: PublicSection[] }>(res);
    const orders = sections.map((section) => section.order);

    expect(orders).toEqual([...orders].sort((a, b) => a - b));
  });

  it('omits disabled sections from the public response', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/landing-page')
      .expect(200);

    const { sections } = data<{ sections: PublicSection[] }>(res);

    // The seeded default disables `faq` and `testimonials` — see
    // landing-page.defaults.ts.
    expect(sections.some((section) => section.key === 'faq')).toBe(false);
    expect(sections.some((section) => section.key === 'testimonials')).toBe(
      false,
    );
  });

  it('rejects unauthenticated access to the admin config endpoint', async () => {
    await request(app.getHttpServer())
      .get('/api/admin/landing-page')
      .expect(401);
  });

  it('rejects a non-admin from reading the admin config endpoint', async () => {
    await request(app.getHttpServer())
      .get('/api/admin/landing-page')
      .set('Authorization', `Bearer ${userAccessToken}`)
      .expect(403);
  });

  it('lets an admin read the full config, including disabled sections', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/admin/landing-page')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .expect(200);

    const config = data<{ sections: AdminSection[] }>(res);

    expect(
      config.sections.some(
        (section) => section.key === 'faq' && section.enabled === false,
      ),
    ).toBe(true);
  });

  it('rejects a non-admin from replacing the config', async () => {
    await request(app.getHttpServer())
      .put('/api/admin/landing-page')
      .set('Authorization', `Bearer ${userAccessToken}`)
      .send({
        sections: [
          { key: 'hero', enabled: true, order: 1, content: { title: 'Hi' } },
        ],
      })
      .expect(403);
  });

  it('rejects a config with duplicate section keys', async () => {
    await request(app.getHttpServer())
      .put('/api/admin/landing-page')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({
        sections: [
          { key: 'hero', enabled: true, order: 1, content: {} },
          { key: 'hero', enabled: true, order: 2, content: {} },
        ],
      })
      .expect(400);
  });

  it('rejects a config with duplicate order values', async () => {
    await request(app.getHttpServer())
      .put('/api/admin/landing-page')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({
        sections: [
          { key: 'hero', enabled: true, order: 1, content: {} },
          { key: 'cta', enabled: true, order: 1, content: {} },
        ],
      })
      .expect(400);
  });

  it('rejects a section with an unsupported key', async () => {
    await request(app.getHttpServer())
      .put('/api/admin/landing-page')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({
        sections: [
          { key: 'not-a-real-section', enabled: true, order: 1, content: {} },
        ],
      })
      .expect(400);
  });

  it('rejects a CTA with an invalid url', async () => {
    await request(app.getHttpServer())
      .put('/api/admin/landing-page')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({
        sections: [
          {
            key: 'hero',
            enabled: true,
            order: 1,
            content: { primaryCta: { text: 'Go', url: 'not a url' } },
          },
        ],
      })
      .expect(400);
  });

  it('lets an admin replace the whole configuration, reordering and reshaping content', async () => {
    const res = await request(app.getHttpServer())
      .put('/api/admin/landing-page')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({
        sections: [
          {
            key: 'cta',
            enabled: true,
            order: 1,
            content: {
              title: 'Join now',
              primaryCta: { text: 'Sign up', url: '/signup' },
            },
          },
          {
            key: 'hero',
            enabled: true,
            order: 2,
            content: { title: 'Welcome to Pawtato' },
          },
          {
            key: 'faq',
            enabled: false,
            order: 3,
            content: {
              faqs: [{ question: 'Is it free?', answer: 'Yes, to start.' }],
            },
          },
        ],
      })
      .expect(200);

    const config = data<{ sections: AdminSection[] }>(res);
    expect(config.sections.map((section) => section.key)).toEqual([
      'cta',
      'hero',
      'faq',
    ]);
  });

  it('the public endpoint reflects the new order and content immediately', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/landing-page')
      .expect(200);

    const { sections } = data<{ sections: PublicSection[] }>(res);

    expect(sections.map((section) => section.key)).toEqual(['cta', 'hero']);
    expect(sections[1].content.title).toBe('Welcome to Pawtato');
  });

  it('rejects a non-admin from toggling a section', async () => {
    await request(app.getHttpServer())
      .patch('/api/admin/landing-page/sections/hero')
      .set('Authorization', `Bearer ${userAccessToken}`)
      .send({ enabled: false })
      .expect(403);
  });

  it('returns 404 when toggling a section key that does not exist in the saved config', async () => {
    await request(app.getHttpServer())
      .patch('/api/admin/landing-page/sections/testimonials')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({ enabled: true })
      .expect(404);
  });

  it('lets an admin enable a previously disabled section without resending the whole config', async () => {
    await request(app.getHttpServer())
      .patch('/api/admin/landing-page/sections/faq')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({ enabled: true })
      .expect(200);

    const res = await request(app.getHttpServer())
      .get('/api/landing-page')
      .expect(200);

    const { sections } = data<{ sections: PublicSection[] }>(res);
    expect(sections.some((section) => section.key === 'faq')).toBe(true);
  });
});
