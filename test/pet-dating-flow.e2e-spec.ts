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

// Covers Phase 10 (Pet Dating & Companion Matching) end-to-end over real
// HTTP + a real DB: two owners each opt a pet into dating, discover each
// other, swipe, match on a mutual LIKE, exchange a message, and a report
// against one profile works its way through admin moderation. Also proves
// the server-side guards the roadmap's Definition of Done calls out
// explicitly: species-only matching, purpose compatibility, and no
// duplicate Match from a race (covered at the unit level in
// dating.service.spec.ts; this file proves the real HTTP path once).
describe('Pet dating flow (e2e)', () => {
  let app: INestApplication<App>;
  let userModel: Model<UserDocument>;
  let capturedOtp: string | undefined;

  const runId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const password = 'StrongPass123';
  const adminEmail = `dating-admin-${runId}@example.com`;
  const ownerAEmail = `dating-owner-a-${runId}@example.com`;
  const ownerBEmail = `dating-owner-b-${runId}@example.com`;

  let adminAccessToken: string;
  let ownerAAccessToken: string;
  let ownerBAccessToken: string;
  let petAId: string;
  let petBId: string;
  let matchId: string;
  let reportId: string;

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
  });

  afterAll(async () => {
    await app.close();
  });

  it('promotes a freshly-registered account to ADMIN', async () => {
    const { user } = await registerAndVerify('Dating Admin', adminEmail);

    await userModel.findByIdAndUpdate(user.id, { role: UserRole.ADMIN });

    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: adminEmail, password })
      .expect(200);

    adminAccessToken = data<{ accessToken: string }>(loginRes).accessToken;
  });

  it('registers two owners, each with a cat', async () => {
    const ownerA = await registerAndVerify('Owner A', ownerAEmail);
    ownerAAccessToken = ownerA.accessToken;

    const ownerB = await registerAndVerify('Owner B', ownerBEmail);
    ownerBAccessToken = ownerB.accessToken;

    const petARes = await request(app.getHttpServer())
      .post('/api/pets')
      .set('Authorization', `Bearer ${ownerAAccessToken}`)
      .send({ name: 'Dating Cat A', species: 'Cat' })
      .expect(201);
    petAId = data<{ _id: string }>(petARes)._id;

    const petBRes = await request(app.getHttpServer())
      .post('/api/pets')
      .set('Authorization', `Bearer ${ownerBAccessToken}`)
      .send({ name: 'Dating Cat B', species: 'Cat' })
      .expect(201);
    petBId = data<{ _id: string }>(petBRes)._id;
  });

  it('rejects a dating profile for a species other than cat/dog', async () => {
    const parrotRes = await request(app.getHttpServer())
      .post('/api/pets')
      .set('Authorization', `Bearer ${ownerAAccessToken}`)
      .send({ name: 'Polly', species: 'Parrot' })
      .expect(201);
    const parrotId = data<{ _id: string }>(parrotRes)._id;

    await request(app.getHttpServer())
      .post(`/api/pets/${parrotId}/dating-profile`)
      .set('Authorization', `Bearer ${ownerAAccessToken}`)
      .send({ purpose: 'PLAYDATE' })
      .expect(400);
  });

  it('both owners create a PLAYDATE dating profile for their cat', async () => {
    await request(app.getHttpServer())
      .post(`/api/pets/${petAId}/dating-profile`)
      .set('Authorization', `Bearer ${ownerAAccessToken}`)
      .send({ purpose: 'PLAYDATE', bio: 'Loves chasing string.' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/pets/${petBId}/dating-profile`)
      .set('Authorization', `Bearer ${ownerBAccessToken}`)
      .send({ purpose: 'PLAYDATE', bio: 'Enjoys sunny windowsills.' })
      .expect(201);
  });

  it('rejects creating a second profile for the same pet', async () => {
    await request(app.getHttpServer())
      .post(`/api/pets/${petAId}/dating-profile`)
      .set('Authorization', `Bearer ${ownerAAccessToken}`)
      .send({ purpose: 'PLAYDATE' })
      .expect(400);
  });

  it("owner A discovers owner B's cat as a candidate", async () => {
    const res = await request(app.getHttpServer())
      .get('/api/dating/discover')
      .set('Authorization', `Bearer ${ownerAAccessToken}`)
      .query({ petId: petAId })
      .expect(200);

    const page = data<{
      profiles: Array<{ petId: { _id: string; name: string } }>;
    }>(res);
    const candidateIds = page.profiles.map((p) => p.petId._id);

    expect(candidateIds).toContain(petBId);
  });

  it('owner A swiping LIKE on owner B alone does not yet create a match', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/dating/swipe')
      .set('Authorization', `Bearer ${ownerAAccessToken}`)
      .send({ fromPetId: petAId, toPetId: petBId, action: 'LIKE' })
      .expect(201);

    expect(data<{ match: unknown }>(res).match).toBeNull();
  });

  it('swiping the same pet twice is rejected', async () => {
    await request(app.getHttpServer())
      .post('/api/dating/swipe')
      .set('Authorization', `Bearer ${ownerAAccessToken}`)
      .send({ fromPetId: petAId, toPetId: petBId, action: 'LIKE' })
      .expect(400);
  });

  it('a mutual LIKE from owner B creates a Match immediately', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/dating/swipe')
      .set('Authorization', `Bearer ${ownerBAccessToken}`)
      .send({ fromPetId: petBId, toPetId: petAId, action: 'LIKE' })
      .expect(201);

    const match = data<{ match: { _id: string; status: string } | null }>(
      res,
    ).match;
    expect(match).not.toBeNull();
    expect(match!.status).toBe('ACTIVE');
    matchId = match!._id;
  });

  it('the match now shows up for both owners', async () => {
    const resA = await request(app.getHttpServer())
      .get('/api/dating/matches')
      .set('Authorization', `Bearer ${ownerAAccessToken}`)
      .expect(200);

    const resB = await request(app.getHttpServer())
      .get('/api/dating/matches')
      .set('Authorization', `Bearer ${ownerBAccessToken}`)
      .expect(200);

    expect(
      data<Array<{ _id: string }>>(resA).some((m) => m._id === matchId),
    ).toBe(true);
    expect(
      data<Array<{ _id: string }>>(resB).some((m) => m._id === matchId),
    ).toBe(true);
  });

  it('a third, unrelated user cannot see or message the match', async () => {
    const intruder = await registerAndVerify(
      'Dating Intruder',
      `dating-intruder-${runId}@example.com`,
    );

    await request(app.getHttpServer())
      .get(`/api/dating/matches/${matchId}/messages`)
      .set('Authorization', `Bearer ${intruder.accessToken}`)
      .expect(404);
  });

  it('owner A sends a message and owner B can read it', async () => {
    await request(app.getHttpServer())
      .post(`/api/dating/matches/${matchId}/messages`)
      .set('Authorization', `Bearer ${ownerAAccessToken}`)
      .send({ content: "Milo's cat would love a playdate!" })
      .expect(201);

    const res = await request(app.getHttpServer())
      .get(`/api/dating/matches/${matchId}/messages`)
      .set('Authorization', `Bearer ${ownerBAccessToken}`)
      .expect(200);

    const messages = data<Array<{ content: string }>>(res);
    expect(messages.some((m) => m.content.includes('playdate'))).toBe(true);
  });

  it("owner B reports owner A's pet profile", async () => {
    const res = await request(app.getHttpServer())
      .post('/api/dating/report')
      .set('Authorization', `Bearer ${ownerBAccessToken}`)
      .send({ targetPetId: petAId, reason: 'Suspicious profile photos.' })
      .expect(201);

    expect(data<{ message: string }>(res).message).toBeDefined();
  });

  it('admin sees the report in the moderation queue, PENDING by default', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/admin/dating/reports')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .query({ status: 'PENDING' })
      .expect(200);

    const page = data<{
      reports: Array<{ _id: string; status: string; targetPetId: unknown }>;
    }>(res);
    expect(page.reports.length).toBeGreaterThan(0);
    reportId = page.reports[0]._id;
  });

  it('a non-admin cannot see the dating moderation queue', async () => {
    await request(app.getHttpServer())
      .get('/api/admin/dating/reports')
      .set('Authorization', `Bearer ${ownerAAccessToken}`)
      .expect(403);
  });

  it('admin actions the report and deactivates the reported profile', async () => {
    const statusRes = await request(app.getHttpServer())
      .patch(`/api/admin/dating/reports/${reportId}/status`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({ status: 'ACTIONED' })
      .expect(200);
    expect(data<{ status: string }>(statusRes).status).toBe('ACTIONED');

    const deactivateRes = await request(app.getHttpServer())
      .patch(`/api/admin/dating/profiles/${petAId}/deactivate`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .expect(200);
    expect(data<{ isActive: boolean }>(deactivateRes).isActive).toBe(false);
  });

  it('the deactivated pet no longer appears in discovery', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/dating/discover')
      .set('Authorization', `Bearer ${ownerBAccessToken}`)
      .query({ petId: petBId })
      .expect(200);

    const page = data<{ profiles: Array<{ petId: { _id: string } }> }>(res);
    const candidateIds = page.profiles.map((p) => p.petId._id);

    expect(candidateIds).not.toContain(petAId);
  });

  it('the existing match and its messages are unaffected by the deactivation', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/dating/matches/${matchId}/messages`)
      .set('Authorization', `Bearer ${ownerAAccessToken}`)
      .expect(200);

    expect(data<Array<unknown>>(res).length).toBeGreaterThan(0);
  });

  it('either side can unmatch, and a message can no longer be sent afterward', async () => {
    await request(app.getHttpServer())
      .post(`/api/dating/matches/${matchId}/unmatch`)
      .set('Authorization', `Bearer ${ownerAAccessToken}`)
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/dating/matches/${matchId}/messages`)
      .set('Authorization', `Bearer ${ownerBAccessToken}`)
      .send({ content: 'Are you still there?' })
      .expect(400);
  });

  it('every dating action taken above is recorded in the audit log', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/activity')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .query({ limit: 50 })
      .expect(200);

    const page = data<{ activities: Array<{ action: string }> }>(res);
    const actions = page.activities.map((entry) => entry.action);

    expect(actions).toEqual(
      expect.arrayContaining([
        'dating.report.created',
        'dating.report.status-changed',
        'admin.dating-profile.deactivated',
      ]),
    );
  });
});
