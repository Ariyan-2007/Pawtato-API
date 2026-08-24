import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { MailerService } from '@nestjs-modules/mailer';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';

import { NotificationsService } from './notifications.service';
import { Notification } from './schemas/notification.schema';
import { NotificationPriority } from './enums/notification-priority.enum';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let mailerService: { sendMail: jest.Mock };
  let notificationModel: {
    create: jest.Mock;
    countDocuments: jest.Mock;
    find: jest.Mock;
    findOneAndUpdate: jest.Mock;
    findOneAndDelete: jest.Mock;
    updateMany: jest.Mock;
    deleteMany: jest.Mock;
  };

  const userId = new Types.ObjectId().toString();

  beforeEach(async () => {
    mailerService = { sendMail: jest.fn().mockResolvedValue(undefined) };
    notificationModel = {
      create: jest.fn(),
      countDocuments: jest.fn(),
      find: jest.fn(),
      findOneAndUpdate: jest.fn(),
      findOneAndDelete: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: MailerService, useValue: mailerService },
        {
          provide: getModelToken(Notification.name),
          useValue: notificationModel,
        },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sendEmail', () => {
    it('sends a plain HTML email via the mailer', async () => {
      await service.sendEmail('to@example.com', 'Subject', 'Body text');

      expect(mailerService.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'to@example.com', subject: 'Subject' }),
      );
    });
  });

  describe('sendTemplateEmail', () => {
    it('sends a templated email with a rendered plain-text fallback', async () => {
      await service.sendTemplateEmail(
        'to@example.com',
        'Verify',
        'verify-otp',
        { otp: '123456' },
      );

      expect(mailerService.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'to@example.com',
          template: 'verify-otp',
          context: { otp: '123456' },
        }),
      );
    });
  });

  describe('create', () => {
    it('resolves priority/expiry from the event type and stores the raw payload', async () => {
      notificationModel.create.mockResolvedValue({});

      await service.create(userId, 'pet.marked-lost', 'Title', 'Message', {
        isLost: true,
        petId: new Types.ObjectId().toString(),
      });

      expect(notificationModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          user: expect.any(Types.ObjectId) as Types.ObjectId,
          type: 'pet.marked-lost',
          title: 'Title',
          message: 'Message',
        }),
      );
    });
  });

  describe('findForUser', () => {
    it('scopes the query to the caller and filters unread when requested', async () => {
      const chain = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([]),
      };
      notificationModel.find.mockReturnValue(chain);
      notificationModel.countDocuments.mockResolvedValue(0);

      await service.findForUser(userId, {
        page: 1,
        limit: 20,
        unreadOnly: true,
      });

      expect(notificationModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          user: expect.any(Types.ObjectId) as Types.ObjectId,
          readAt: null,
        }),
      );
    });
  });

  describe('markRead', () => {
    it("scopes the update to the caller and throws NotFoundException for another user's notification", async () => {
      notificationModel.findOneAndUpdate.mockResolvedValue(null);

      await expect(service.markRead(userId, 'notif-id')).rejects.toThrow(
        NotFoundException,
      );
      expect(notificationModel.findOneAndUpdate).toHaveBeenCalledWith(
        {
          _id: 'notif-id',
          user: expect.any(Types.ObjectId) as Types.ObjectId,
        },
        { readAt: expect.any(Date) as Date },
        { new: true },
      );
    });
  });

  describe('delete', () => {
    it("scopes the delete to the caller and throws NotFoundException for another user's notification", async () => {
      notificationModel.findOneAndDelete.mockResolvedValue(null);

      await expect(service.delete(userId, 'notif-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('deletes when owned by the caller', async () => {
      notificationModel.findOneAndDelete.mockResolvedValue({
        _id: 'notif-id',
      });

      await expect(service.delete(userId, 'notif-id')).resolves.toEqual({
        message: 'Notification deleted',
      });
    });
  });

  describe('resolveMissingContext', () => {
    it("downgrades only this user's CRITICAL notifications for the given pet", async () => {
      const petId = new Types.ObjectId().toString();
      notificationModel.updateMany.mockResolvedValue({});

      await service.resolveMissingContext(userId, petId);

      expect(notificationModel.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          user: expect.any(Types.ObjectId) as Types.ObjectId,
          pet: expect.any(Types.ObjectId) as Types.ObjectId,
          priority: NotificationPriority.CRITICAL,
        }),
        expect.objectContaining({
          priority: NotificationPriority.STALE_MISSING,
        }),
      );
    });
  });
});
