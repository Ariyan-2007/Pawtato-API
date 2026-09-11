import { INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { MailerService } from '@nestjs-modules/mailer';
import request from 'supertest';
import type { Response } from 'supertest';
import type { App } from 'supertest/types';
import type { Model } from 'mongoose';

import { createTestApp } from './test-app';
import { StripeService } from '../src/modules/tag-orders/stripe.service';
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

// Covers the two things Phase 20's own Status note flagged as shipped-but-
// not-e2e-tested ("the new admin/auth surfaces are unit-tested but not yet
// driven over real HTTP + a real DB the way most other phases are"): rotating
// refresh tokens (POST /auth/refresh) and the enriched admin dashboard —
// tag/dating/caretaker/commerce figures, pendingModeration, analytics'
// tagStatusBreakdown/datingFunnel/identityVerification/monthlyRevenue,
// POST /admin/notifications/broadcast, and PATCH /admin/tag-orders/:id/cancel
// (refund-then-cancel via StripeService, stubbed at its one boundary the same
// way tag-orders-flow.e2e-spec.ts already does).
describe('Admin dashboard enrichment & auth refresh tokens (e2e)', () => {
  let app: INestApplication<App>;
  let userModel: Model<UserDocument>;
  let capturedOtp: string | undefined;

  const runId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const password = 'StrongPass123';
  const adminEmail = `admin-dash-admin-${runId}@example.com`;
  const userEmail = `admin-dash-user-${runId}@example.com`;

  const fakePaymentIntentId = `pi_test_${runId}`;
  let createdOrderId: string | undefined;
  let lastCheckoutSessionId: string | undefined;
  let sessionCounter = 0;

  const stripeServiceMock = {
    createCheckoutSession: jest.fn(
      (order: {
        orderId: string;
        quantity: number;
        unitPriceCents: number;
        currency: string;
      }) => {
        createdOrderId = order.orderId;
        // Each order needs its own session id (Tag Order enforces a unique
        // index on stripeCheckoutSessionId) — this suite creates more than
        // one order, unlike tag-orders-flow.e2e-spec.ts's single-order flow.
        lastCheckoutSessionId = `cs_test_${runId}_${sessionCounter++}`;
        return Promise.resolve({
          id: lastCheckoutSessionId,
          url: 'https://checkout.stripe.com/test-session',
        });
      },
    ),
    constructWebhookEvent: jest.fn(() => ({
      type: 'checkout.session.completed',
      data: {
        object: {
          id: lastCheckoutSessionId,
          metadata: { orderId: createdOrderId },
          payment_intent: fakePaymentIntentId,
        },
      },
    })),
    extractPaymentIntentId: jest.fn(
      (session: { payment_intent?: string }) => session.payment_intent,
    ),
    refundPayment: jest.fn(() =>
      Promise.resolve({ id: `re_${runId}`, status: 'succeeded' }),
    ),
  };

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

    return data<{
      accessToken: string;
      refreshToken: string;
      user: { id: string };
    }>(verifyRes);
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
      builder
        .overrideProvider(MailerService)
        .useValue(mailerService)
        .overrideProvider(StripeService)
        .useValue(stripeServiceMock),
    );

    userModel = app.get<Model<UserDocument>>(getModelToken(User.name));
  });

  afterAll(async () => {
    await app.close();
  });

  it('promotes a freshly-registered account to ADMIN and re-logs-in for a token carrying that role', async () => {
    const { user } = await registerAndVerify('Dash Admin', adminEmail);

    await userModel.findByIdAndUpdate(user.id, { role: UserRole.ADMIN });

    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: adminEmail, password })
      .expect(200);

    const login = data<{ accessToken: string; user: { role: string } }>(
      loginRes,
    );
    adminAccessToken = login.accessToken;
    expect(login.user.role).toBe(UserRole.ADMIN);
  });

  it('registers a regular user account', async () => {
    const { accessToken } = await registerAndVerify('Dash User', userEmail);
    userAccessToken = accessToken;
  });

  describe('POST /auth/refresh', () => {
    let firstRefreshToken: string;

    it('login returns both an accessToken and a refreshToken', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: userEmail, password })
        .expect(200);

      const body = data<{ accessToken: string; refreshToken: string }>(res);
      expect(body.accessToken).toEqual(expect.any(String));
      expect(body.refreshToken).toEqual(expect.any(String));

      firstRefreshToken = body.refreshToken;
    });

    it('exchanges a valid refresh token for a new access+refresh pair', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .send({ refreshToken: firstRefreshToken })
        .expect(200);

      const body = data<{ accessToken: string; refreshToken: string }>(res);
      expect(body.accessToken).toEqual(expect.any(String));
      expect(body.refreshToken).toEqual(expect.any(String));
      expect(body.refreshToken).not.toBe(firstRefreshToken);

      // The new access token is real and usable, not just well-formed.
      await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${body.accessToken}`)
        .expect(200);
    });

    it('rejects the same refresh token a second time (rotation)', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .send({ refreshToken: firstRefreshToken })
        .expect(401);
    });

    it('rejects an access token presented as a refresh token', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .send({ refreshToken: userAccessToken })
        .expect(401);
    });

    it('rejects a garbage refresh token', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .send({ refreshToken: 'not-a-real-token' })
        .expect(401);
    });
  });

  describe('GET /admin/dashboard and /admin/analytics', () => {
    it('a non-admin cannot reach either', async () => {
      await request(app.getHttpServer())
        .get('/api/admin/dashboard')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(403);

      await request(app.getHttpServer())
        .get('/api/admin/analytics')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(403);
    });

    it('the dashboard is enriched with every Phase 20 subsystem summary', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/admin/dashboard')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);

      const body = data<{
        totalUsers: number;
        tags: { total: number; manufactured: number; assigned: number };
        dating: { activeProfiles: number; totalMatches: number };
        caretakers: { totalGrants: number };
        commerce: { pendingPayment: number; totalRevenueCents: number };
        pendingModeration: {
          foundReports: number;
          datingReports: number;
          identityVerifications: number;
        };
      }>(res);

      expect(body.totalUsers).toBeGreaterThan(0);
      expect(body.tags).toEqual(
        expect.objectContaining({
          total: expect.any(Number) as number,
          manufactured: expect.any(Number) as number,
          assigned: expect.any(Number) as number,
        }),
      );
      expect(body.dating).toEqual(
        expect.objectContaining({
          activeProfiles: expect.any(Number) as number,
          totalMatches: expect.any(Number) as number,
        }),
      );
      expect(body.caretakers).toEqual(
        expect.objectContaining({ totalGrants: expect.any(Number) as number }),
      );
      expect(body.commerce).toEqual(
        expect.objectContaining({
          pendingPayment: expect.any(Number) as number,
          totalRevenueCents: expect.any(Number) as number,
        }),
      );
      expect(body.pendingModeration).toEqual({
        foundReports: expect.any(Number) as number,
        datingReports: expect.any(Number) as number,
        identityVerifications: expect.any(Number) as number,
      });
    });

    it('analytics is enriched with the real per-scan monthlyQrScans plus the new engagement/revenue breakdowns', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/admin/analytics')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);

      const body = data<{
        monthlyQrScans: number[];
        tagStatusBreakdown: Array<{ status: string; count: number }>;
        datingFunnel: {
          totalSwipes: number;
          totalLikes: number;
          totalMatches: number;
          matchRate: number;
        };
        identityVerification: { pending: number; approvalRate: number };
        monthlyRevenue: number[];
      }>(res);

      // The real regression this phase fixed: monthlyQrScans used to be
      // declared on the DTO but never populated at all (always undefined).
      expect(Array.isArray(body.monthlyQrScans)).toBe(true);
      expect(Array.isArray(body.tagStatusBreakdown)).toBe(true);
      expect(body.datingFunnel).toEqual(
        expect.objectContaining({
          totalSwipes: expect.any(Number) as number,
          totalLikes: expect.any(Number) as number,
          totalMatches: expect.any(Number) as number,
          matchRate: expect.any(Number) as number,
        }),
      );
      expect(body.identityVerification).toEqual(
        expect.objectContaining({ pending: expect.any(Number) as number }),
      );
      expect(Array.isArray(body.monthlyRevenue)).toBe(true);
    });
  });

  describe('POST /admin/notifications/broadcast', () => {
    it('a non-admin cannot broadcast', async () => {
      await request(app.getHttpServer())
        .post('/api/admin/notifications/broadcast')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({ title: 'Should not work', message: 'Should not work' })
        .expect(403);
    });

    it('reaches every active account through the real notification pipeline', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/admin/notifications/broadcast')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          title: 'Scheduled maintenance',
          message: 'Pawtato will be briefly unavailable tonight.',
          role: 'USER',
        })
        .expect(201);

      const body = data<{ recipientCount: number }>(res);
      expect(body.recipientCount).toBeGreaterThan(0);

      const inbox = await request(app.getHttpServer())
        .get('/api/notifications')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(200);

      const page = data<{
        notifications: Array<{ title: string; message: string }>;
      }>(inbox);
      expect(
        page.notifications.some((n) => n.title === 'Scheduled maintenance'),
      ).toBe(true);
    });
  });

  describe('PATCH /admin/tag-orders/:id/cancel', () => {
    it('cancels a PENDING_PAYMENT order outright, with no refund call', async () => {
      const orderRes = await request(app.getHttpServer())
        .post('/api/tag-orders')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({
          quantity: 2,
          shippingAddress: {
            fullName: 'Dash User',
            line1: 'House 1, Road 1',
            city: 'Dhaka',
            state: 'Dhaka',
            postalCode: '1205',
            country: 'Bangladesh',
          },
        })
        .expect(201);

      const pendingOrderId = data<{ orderId: string }>(orderRes).orderId;
      const refundCallsBefore =
        stripeServiceMock.refundPayment.mock.calls.length;

      const cancelRes = await request(app.getHttpServer())
        .patch(`/api/admin/tag-orders/${pendingOrderId}/cancel`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(data<{ status: string }>(cancelRes).status).toBe('CANCELLED');
      expect(stripeServiceMock.refundPayment.mock.calls.length).toBe(
        refundCallsBefore,
      );
    });

    it('refunds through Stripe first, then cancels a PAID order', async () => {
      // createdOrderId is populated by createCheckoutSession above once this
      // flow's own order is created.
      await request(app.getHttpServer())
        .post('/api/tag-orders')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({
          quantity: 1,
          shippingAddress: {
            fullName: 'Dash User',
            line1: 'House 1, Road 1',
            city: 'Dhaka',
            state: 'Dhaka',
            postalCode: '1205',
            country: 'Bangladesh',
          },
        })
        .expect(201);

      await request(app.getHttpServer())
        .post('/api/tag-orders/webhook')
        .set('Stripe-Signature', 't=0,v1=fake-signature-verification-is-mocked')
        .send({ id: 'evt_test_cancel', type: 'checkout.session.completed' })
        .expect(201);

      const paidOrderRes = await request(app.getHttpServer())
        .get(`/api/tag-orders/${createdOrderId}`)
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(200);
      expect(data<{ status: string }>(paidOrderRes).status).toBe('PAID');

      const cancelRes = await request(app.getHttpServer())
        .patch(`/api/admin/tag-orders/${createdOrderId}/cancel`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(data<{ status: string }>(cancelRes).status).toBe('CANCELLED');
      expect(stripeServiceMock.refundPayment).toHaveBeenCalledWith(
        fakePaymentIntentId,
      );
    });

    it('rejects cancelling an order twice', async () => {
      await request(app.getHttpServer())
        .patch(`/api/admin/tag-orders/${createdOrderId}/cancel`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(400);
    });

    it('a non-admin cannot cancel a tag order', async () => {
      await request(app.getHttpServer())
        .patch(`/api/admin/tag-orders/${createdOrderId}/cancel`)
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(403);
    });
  });
});
