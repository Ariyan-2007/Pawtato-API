import { MongoMemoryServer } from 'mongodb-memory-server';
import { setMongod } from './mongod-holder';

// Runs once before every e2e suite in this run. Starts a real, throwaway
// mongod (no Docker/external service needed — works the same in CI as it
// does locally) and points every test file at it by setting process.env
// here: Jest forks each test file's worker after globalSetup resolves, and
// those workers inherit process.env at fork time.
export default async function globalSetup() {
  const mongod = await MongoMemoryServer.create();
  setMongod(mongod);

  process.env.MONGO_URI = mongod.getUri('pawtato-e2e');
  process.env.NODE_ENV ||= 'test';
  process.env.JWT_SECRET ||= 'e2e-test-jwt-secret-not-for-production-use';
  process.env.JWT_EXPIRES ||= '1d';
  process.env.REFRESH_SECRET ||= 'e2e-test-refresh-secret-not-for-prod-use';
  process.env.REFRESH_EXPIRES ||= '7d';
  process.env.STORAGE_PROVIDER ||= 'local';
  process.env.APP_URL ||= 'http://localhost:5000';
  process.env.FRONTEND_URL ||= 'http://localhost:3000';
  process.env.CORS_ORIGINS ||= '';

  // Deliberately blanked to '', not deleted: ConfigModule's
  // `envFilePath: '.env'` loads the real project .env unconditionally (not
  // gated on NODE_ENV) *inside each test file's own AppModule compilation*
  // — i.e. after this globalSetup has already run — and dotenv only skips a
  // key it finds already present on `process.env` (`hasOwnProperty`, not a
  // truthiness check). `delete` leaves the key absent, so dotenv happily
  // reloads it straight from the real .env file the moment ConfigModule
  // boots; an empty string is still "present" and blocks that reload. A
  // developer's real optional provider credentials would otherwise leak
  // into e2e runs and make "provider not configured" tests non-deterministic
  // depending on what happens to be in their local .env — exactly what broke
  // push-notifications.e2e-spec.ts's "reports null" test the first time a
  // real VAPID_PUBLIC_KEY was added there. Specs that need these configured
  // override the owning service via DI instead (StripeService,
  // WebPushService) rather than relying on real env values, so blanking
  // these costs no coverage.
  process.env.VAPID_PUBLIC_KEY = '';
  process.env.VAPID_PRIVATE_KEY = '';
  process.env.VAPID_SUBJECT = '';
  process.env.STRIPE_SECRET_KEY = '';
  process.env.STRIPE_WEBHOOK_SECRET = '';
}
