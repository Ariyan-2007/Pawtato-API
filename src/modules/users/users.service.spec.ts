import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed-password'),
}));

import { UsersService } from './users.service';
import { User } from './schemas/user.schema';
import { Pet } from '../pets/schemas/pet.schema';
import { AccountStatus } from '../../common/enums/account-status.enum';
import { STORAGE_PROVIDER } from '../storage/storage.constants';

describe('UsersService', () => {
  let service: UsersService;
  let userModel: {
    create: jest.Mock;
    findOne: jest.Mock;
    findByIdAndUpdate: jest.Mock;
  };

  beforeEach(async () => {
    userModel = {
      create: jest.fn(),
      findOne: jest.fn(),
      findByIdAndUpdate: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getModelToken(User.name), useValue: userModel },
        { provide: getModelToken(Pet.name), useValue: {} },
        { provide: STORAGE_PROVIDER, useValue: {} },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createUser', () => {
    it('hashes the password and creates the account as PendingVerification', async () => {
      userModel.create.mockResolvedValue({ id: 'user-1' });

      await service.createUser({
        fullName: 'Sarah Ahmed',
        email: 'sarah@example.com',
        password: 'StrongPass123',
      });

      expect(bcrypt.hash).toHaveBeenCalledWith('StrongPass123', 10);
      expect(userModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'sarah@example.com',
          password: 'hashed-password',
          status: AccountStatus.PENDING_VERIFICATION,
        }),
      );
    });

    it('propagates a duplicate-key error to the caller instead of swallowing it', async () => {
      const duplicateKeyError = Object.assign(new Error('E11000'), {
        code: 11000,
      });
      userModel.create.mockRejectedValue(duplicateKeyError);

      await expect(
        service.createUser({
          fullName: 'Sarah Ahmed',
          email: 'sarah@example.com',
          password: 'StrongPass123',
        }),
      ).rejects.toBe(duplicateKeyError);
    });
  });

  describe('findByEmail', () => {
    it('selects the password and OTP fields needed by the auth flows', async () => {
      const select = jest
        .fn()
        .mockResolvedValue({ email: 'sarah@example.com' });
      userModel.findOne.mockReturnValue({ select });

      const result = await service.findByEmail('sarah@example.com');

      expect(userModel.findOne).toHaveBeenCalledWith({
        email: 'sarah@example.com',
      });
      expect(select).toHaveBeenCalledWith('+password +otpHash +otpAttempts');
      expect(result).toEqual({ email: 'sarah@example.com' });
    });
  });

  describe('setOtp', () => {
    it('overwrites the OTP fields and resets the attempt counter', async () => {
      userModel.findByIdAndUpdate.mockResolvedValue({});
      const expiresAt = new Date();

      await service.setOtp('user-1', 'hash-value', expiresAt);

      expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith('user-1', {
        otpHash: 'hash-value',
        otpExpiresAt: expiresAt,
        otpAttempts: 0,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- jest's `expect.any` is untyped (`any`) by design
        otpLastSentAt: expect.any(Date),
      });
    });
  });

  describe('activateAccount', () => {
    it('flips status to Active and clears every OTP field', async () => {
      const select = jest
        .fn()
        .mockResolvedValue({ status: AccountStatus.ACTIVE });
      userModel.findByIdAndUpdate.mockReturnValue({ select });

      const result = await service.activateAccount('user-1');

      expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          status: AccountStatus.ACTIVE,
          otpHash: null,
          otpExpiresAt: null,
          otpAttempts: 0,
          otpLastSentAt: null,
        }),
        { new: true },
      );
      expect(result).toEqual({ status: AccountStatus.ACTIVE });
    });
  });

  describe('clearOtp', () => {
    it('invalidates the current OTP without touching status', async () => {
      userModel.findByIdAndUpdate.mockResolvedValue({});

      await service.clearOtp('user-1');

      expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith('user-1', {
        otpHash: null,
        otpExpiresAt: null,
        otpAttempts: 0,
      });
    });
  });
});
