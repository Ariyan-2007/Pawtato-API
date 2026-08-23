import { randomInt } from 'crypto';

// Standard 6-digit numeric OTP (100000-999999), generated with a CSPRNG
// rather than Math.random() since this guards email verification and
// password reset.
export function generateOtp(): string {
  return String(randomInt(100000, 1000000));
}
