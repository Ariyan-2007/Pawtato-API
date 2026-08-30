import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';

import { TagOrdersService } from './tag-orders.service';
import { TagOrder } from './schemas/tag-order.schema';
import { StripeService } from './stripe.service';
import { TagsService } from '../tags/tags.service';
import { ActivityService } from '../activity/activity.service';
import { TagOrderStatus } from '../../common/enums/tag-order-status.enum';

describe('TagOrdersService', () => {
  let service: TagOrdersService;
  let tagOrderModel: {
    create: jest.Mock;
    findById: jest.Mock;
    find: jest.Mock;
    countDocuments: jest.Mock;
    aggregate: jest.Mock;
  };
  let configService: { get: jest.Mock; getOrThrow: jest.Mock };
  let stripeService: {
    createCheckoutSession: jest.Mock;
    extractPaymentIntentId: jest.Mock;
    refundPayment: jest.Mock;
  };
  let tagsService: { mintManufacturedBatch: jest.Mock };
  let activityService: { log: jest.Mock };

  const userId = new Types.ObjectId().toString();
  const shippingAddress = {
    fullName: 'Ariyan',
    line1: 'House 1',
    city: 'Dhaka',
    state: 'Dhaka',
    postalCode: '1205',
    country: 'Bangladesh',
  };

  beforeEach(async () => {
    tagOrderModel = {
      create: jest.fn(),
      findById: jest.fn(),
      find: jest.fn(),
      countDocuments: jest.fn(),
      aggregate: jest.fn(),
    };
    configService = {
      get: jest.fn((key: string, fallback?: unknown) => {
        if (key === 'app.frontendUrl') {
          return 'https://app.pawtato.com';
        }

        if (key === 'stripe.currency') {
          return fallback ?? 'usd';
        }

        return fallback;
      }),
      getOrThrow: jest.fn((key: string) => {
        const values: Record<string, unknown> = {
          'stripe.tagUnitPriceCents': 999,
          'stripe.currency': 'usd',
        };
        return values[key];
      }),
    };
    stripeService = {
      createCheckoutSession: jest.fn(),
      extractPaymentIntentId: jest.fn().mockReturnValue('pi_123'),
      refundPayment: jest.fn().mockResolvedValue({ id: 're_123' }),
    };
    tagsService = { mintManufacturedBatch: jest.fn() };
    activityService = { log: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TagOrdersService,
        { provide: getModelToken(TagOrder.name), useValue: tagOrderModel },
        { provide: ConfigService, useValue: configService },
        { provide: StripeService, useValue: stripeService },
        { provide: TagsService, useValue: tagsService },
        { provide: ActivityService, useValue: activityService },
      ],
    }).compile();

    service = module.get<TagOrdersService>(TagOrdersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createOrder', () => {
    it('computes the total from config pricing and returns the checkout URL', async () => {
      stripeService.createCheckoutSession.mockResolvedValue({
        id: 'cs_123',
        url: 'https://checkout.stripe.com/session',
      });
      tagOrderModel.create.mockImplementation((doc: Record<string, unknown>) =>
        Promise.resolve(doc),
      );

      const result = await service.createOrder(userId, {
        quantity: 3,
        shippingAddress,
      });

      expect(stripeService.createCheckoutSession).toHaveBeenCalledWith(
        expect.objectContaining({
          quantity: 3,
          unitPriceCents: 999,
          currency: 'usd',
        }),
      );
      expect(tagOrderModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: expect.any(Types.ObjectId) as Types.ObjectId,
          quantity: 3,
          unitPriceCents: 999,
          totalAmountCents: 2997,
          currency: 'usd',
          status: TagOrderStatus.PENDING_PAYMENT,
          stripeCheckoutSessionId: 'cs_123',
        }),
      );
      expect(result.checkoutUrl).toBe('https://checkout.stripe.com/session');
    });
  });

  describe('handleCheckoutCompleted', () => {
    it('marks the order PAID and mints its tag batch exactly once', async () => {
      const order = {
        _id: new Types.ObjectId(),
        quantity: 2,
        status: TagOrderStatus.PENDING_PAYMENT,
        save: jest.fn().mockResolvedValue(undefined),
      };
      tagOrderModel.findById.mockResolvedValue(order);

      await service.handleCheckoutCompleted({
        id: 'cs_123',
        metadata: { orderId: order._id.toString() },
        payment_intent: 'pi_123',
      } as never);

      expect(order.status).toBe(TagOrderStatus.PAID);
      expect(order.save).toHaveBeenCalled();
      expect(tagsService.mintManufacturedBatch).toHaveBeenCalledWith(
        2,
        expect.stringContaining('/qr'),
        `order-${order._id.toString()}`,
      );
    });

    it('is a no-op for an order that is already PAID (idempotent webhook redelivery)', async () => {
      const order = {
        _id: new Types.ObjectId(),
        quantity: 2,
        status: TagOrderStatus.PAID,
        save: jest.fn(),
      };
      tagOrderModel.findById.mockResolvedValue(order);

      await service.handleCheckoutCompleted({
        id: 'cs_123',
        metadata: { orderId: order._id.toString() },
      } as never);

      expect(order.save).not.toHaveBeenCalled();
      expect(tagsService.mintManufacturedBatch).not.toHaveBeenCalled();
    });

    it('does nothing when the session has no orderId in metadata', async () => {
      await service.handleCheckoutCompleted({
        id: 'cs_123',
        metadata: {},
      } as never);

      expect(tagOrderModel.findById).not.toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException when the order does not exist', async () => {
      tagOrderModel.findById.mockResolvedValue(null);

      await expect(service.findOne(userId, 'id', false)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException for a non-admin caller who does not own the order', async () => {
      const order = {
        userId: { equals: jest.fn().mockReturnValue(false) },
      };
      tagOrderModel.findById.mockResolvedValue(order);

      await expect(service.findOne(userId, 'id', false)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('allows an admin to view any order', async () => {
      const order = { userId: { equals: jest.fn().mockReturnValue(false) } };
      tagOrderModel.findById.mockResolvedValue(order);

      await expect(service.findOne(userId, 'id', true)).resolves.toBe(order);
    });
  });

  describe('adminMarkShipped', () => {
    it('throws BadRequestException when the order is not PAID', async () => {
      tagOrderModel.findById.mockResolvedValue({
        status: TagOrderStatus.PENDING_PAYMENT,
      });

      await expect(
        service.adminMarkShipped('admin-1', 'id', {
          trackingNumber: 'TRACK1',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('marks a PAID order FULFILLED and logs the action', async () => {
      const order = {
        _id: new Types.ObjectId(),
        status: TagOrderStatus.PAID,
        save: jest.fn().mockResolvedValue(undefined),
      };
      tagOrderModel.findById.mockResolvedValue(order);

      await service.adminMarkShipped('admin-1', 'id', {
        trackingNumber: 'TRACK1',
      });

      expect(order.status).toBe(TagOrderStatus.FULFILLED);
      expect(order.save).toHaveBeenCalled();
      expect(activityService.log).toHaveBeenCalledWith(
        'admin-1',
        'tag-order.shipped',
        order._id.toString(),
        { trackingNumber: 'TRACK1' },
      );
    });
  });

  describe('adminCancel', () => {
    it('throws NotFoundException for an unknown order', async () => {
      tagOrderModel.findById.mockResolvedValue(null);

      await expect(service.adminCancel('admin-1', 'id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it.each([TagOrderStatus.FULFILLED, TagOrderStatus.CANCELLED])(
      'rejects cancelling an order that is already %s',
      async (status) => {
        tagOrderModel.findById.mockResolvedValue({ status });

        await expect(service.adminCancel('admin-1', 'id')).rejects.toThrow(
          BadRequestException,
        );
        expect(stripeService.refundPayment).not.toHaveBeenCalled();
      },
    );

    it('cancels a PENDING_PAYMENT order outright, with no refund call', async () => {
      const order = {
        _id: new Types.ObjectId(),
        status: TagOrderStatus.PENDING_PAYMENT,
        save: jest.fn().mockResolvedValue(undefined),
      };
      tagOrderModel.findById.mockResolvedValue(order);

      await service.adminCancel('admin-1', 'id');

      expect(stripeService.refundPayment).not.toHaveBeenCalled();
      expect(order.status).toBe(TagOrderStatus.CANCELLED);
      expect(order.save).toHaveBeenCalled();
      expect(activityService.log).toHaveBeenCalledWith(
        'admin-1',
        'tag-order.cancelled',
        order._id.toString(),
        { refunded: false },
      );
    });

    it('refunds a PAID order through Stripe before marking it CANCELLED', async () => {
      const order = {
        _id: new Types.ObjectId(),
        status: TagOrderStatus.PAID,
        stripePaymentIntentId: 'pi_123',
        save: jest.fn().mockResolvedValue(undefined),
      };
      tagOrderModel.findById.mockResolvedValue(order);

      await service.adminCancel('admin-1', 'id');

      expect(stripeService.refundPayment).toHaveBeenCalledWith('pi_123');
      expect(order.status).toBe(TagOrderStatus.CANCELLED);
      expect(activityService.log).toHaveBeenCalledWith(
        'admin-1',
        'tag-order.cancelled',
        order._id.toString(),
        { refunded: true },
      );
    });

    it('refuses to cancel a PAID order with no recorded payment intent, rather than silently skipping the refund', async () => {
      tagOrderModel.findById.mockResolvedValue({
        status: TagOrderStatus.PAID,
        stripePaymentIntentId: undefined,
      });

      await expect(service.adminCancel('admin-1', 'id')).rejects.toThrow(
        BadRequestException,
      );
      expect(stripeService.refundPayment).not.toHaveBeenCalled();
    });
  });

  describe('adminRevenueSummary', () => {
    it('combines the status-count aggregation with the revenue-sum aggregation', async () => {
      tagOrderModel.aggregate
        .mockResolvedValueOnce([
          { _id: TagOrderStatus.PAID, count: 2 },
          { _id: TagOrderStatus.FULFILLED, count: 1 },
        ])
        .mockResolvedValueOnce([{ _id: null, totalCents: 5000 }]);

      const result = await service.adminRevenueSummary();

      expect(result).toEqual({
        countByStatus: {
          PENDING_PAYMENT: 0,
          PAID: 2,
          FULFILLED: 1,
          CANCELLED: 0,
        },
        totalRevenueCents: 5000,
        currency: 'usd',
      });
    });

    it('reports zero revenue rather than throwing when nothing has been paid yet', async () => {
      tagOrderModel.aggregate
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await service.adminRevenueSummary();

      expect(result.totalRevenueCents).toBe(0);
    });
  });

  describe('monthlyRevenue', () => {
    it('buckets PAID/FULFILLED orders by the calendar month they were paid in', async () => {
      const paidInJanuary = new Date(new Date().getFullYear(), 0, 15);
      tagOrderModel.find.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          { totalAmountCents: 1000, paidAt: paidInJanuary },
          { totalAmountCents: 500, paidAt: paidInJanuary },
        ]),
      });

      const result = await service.monthlyRevenue();

      expect(result[0]).toBe(1500);
      expect(result.filter((_, i) => i !== 0).every((n) => n === 0)).toBe(true);
    });
  });
});
