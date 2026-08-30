import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import type Stripe from 'stripe';

import { TagOrder, TagOrderDocument } from './schemas/tag-order.schema';
import { CreateTagOrderDto } from './dto/create-tag-order.dto';
import { ShipTagOrderDto } from './dto/ship-tag-order.dto';
import { AdminTagOrderQueryDto } from './dto/admin-tag-order-query.dto';
import { StripeService } from './stripe.service';
import { TagsService } from '../tags/tags.service';
import { ActivityService } from '../activity/activity.service';
import { TagOrderStatus } from '../../common/enums/tag-order-status.enum';

@Injectable()
export class TagOrdersService {
  private readonly logger = new Logger(TagOrdersService.name);

  constructor(
    @InjectModel(TagOrder.name)
    private readonly tagOrderModel: Model<TagOrderDocument>,

    private readonly configService: ConfigService,
    private readonly stripeService: StripeService,
    private readonly tagsService: TagsService,
    private readonly activityService: ActivityService,
  ) {}

  async createOrder(userId: string, dto: CreateTagOrderDto) {
    const unitPriceCents = this.configService.getOrThrow<number>(
      'stripe.tagUnitPriceCents',
    );
    const currency = this.configService.getOrThrow<string>('stripe.currency');
    const totalAmountCents = dto.quantity * unitPriceCents;

    // Generated up front so it can go into the Stripe session's metadata
    // before the order document exists — avoids a two-step
    // create-then-update dance (and the resulting window where a
    // required+unique stripeCheckoutSessionId would otherwise be absent).
    const orderId = new Types.ObjectId();

    const session = await this.stripeService.createCheckoutSession({
      orderId: orderId.toString(),
      quantity: dto.quantity,
      unitPriceCents,
      currency,
    });

    const order = await this.tagOrderModel.create({
      _id: orderId,
      userId: new Types.ObjectId(userId),
      quantity: dto.quantity,
      unitPriceCents,
      totalAmountCents,
      currency,
      shippingAddress: dto.shippingAddress,
      status: TagOrderStatus.PENDING_PAYMENT,
      stripeCheckoutSessionId: session.id,
    });

    return { orderId: order._id.toString(), checkoutUrl: session.url };
  }

  // Called from the webhook controller once the signature is verified.
  // Idempotent: Stripe can (and does) redeliver the same event, and a
  // PENDING_PAYMENT guard means a second delivery is a no-op rather than
  // minting a second batch of tags for the same paid order.
  async handleCheckoutCompleted(session: Stripe.Checkout.Session) {
    const orderId = session.metadata?.orderId;

    if (!orderId) {
      this.logger.warn(
        `checkout.session.completed with no orderId in metadata (session ${session.id})`,
      );
      return;
    }

    const order = await this.tagOrderModel.findById(orderId);

    if (!order) {
      this.logger.warn(`No TagOrder found for orderId ${orderId}`);
      return;
    }

    if (order.status !== TagOrderStatus.PENDING_PAYMENT) {
      return;
    }

    order.status = TagOrderStatus.PAID;
    order.stripePaymentIntentId =
      this.stripeService.extractPaymentIntentId(session);
    order.paidAt = new Date();

    await order.save();

    const frontendUrl = this.configService.get<string>('app.frontendUrl');

    await this.tagsService.mintManufacturedBatch(
      order.quantity,
      `${frontendUrl}/qr`,
      `order-${order._id.toString()}`,
    );
  }

  async findMine(userId: string) {
    return this.tagOrderModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 });
  }

  async findOne(userId: string, id: string, isAdmin: boolean) {
    const order = await this.tagOrderModel.findById(id);

    if (!order) {
      throw new NotFoundException('Tag order not found');
    }

    if (!isAdmin && !order.userId.equals(userId)) {
      throw new ForbiddenException('You do not own this order');
    }

    return order;
  }

  async adminList(query: AdminTagOrderQueryDto) {
    const { page, limit, status } = query;

    const filter = status ? { status } : {};

    const total = await this.tagOrderModel.countDocuments(filter);

    const orders = await this.tagOrderModel
      .find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    return {
      orders,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async adminMarkShipped(actorId: string, id: string, dto: ShipTagOrderDto) {
    const order = await this.tagOrderModel.findById(id);

    if (!order) {
      throw new NotFoundException('Tag order not found');
    }

    if (order.status !== TagOrderStatus.PAID) {
      throw new BadRequestException(
        'Only a paid order can be marked as shipped',
      );
    }

    order.status = TagOrderStatus.FULFILLED;
    order.trackingNumber = dto.trackingNumber;
    order.fulfilledAt = new Date();

    await order.save();

    await this.activityService.log(
      actorId,
      'tag-order.shipped',
      order._id.toString(),
      { trackingNumber: dto.trackingNumber },
    );

    return order;
  }

  // Customer-service cancellation. A still-unpaid order is just marked
  // CANCELLED outright — nothing was ever charged. A PAID-but-not-yet-shipped
  // order is refunded in full through Stripe first (this feature has no
  // partial-fulfillment/partial-refund concept — see StripeService.refundPayment)
  // and only marked CANCELLED once that succeeds, so a failed refund never
  // leaves the order silently cancelled while the customer's money is still
  // gone. A FULFILLED order can no longer be cancelled here — tags have
  // already shipped, so undoing that is a manual, non-API process.
  async adminCancel(actorId: string, id: string) {
    const order = await this.tagOrderModel.findById(id);

    if (!order) {
      throw new NotFoundException('Tag order not found');
    }

    if (
      order.status === TagOrderStatus.FULFILLED ||
      order.status === TagOrderStatus.CANCELLED
    ) {
      throw new BadRequestException(
        `An order that is already ${order.status.toLowerCase()} cannot be cancelled here.`,
      );
    }

    const wasPaid = order.status === TagOrderStatus.PAID;

    if (wasPaid) {
      if (!order.stripePaymentIntentId) {
        throw new BadRequestException(
          'This order is marked PAID but has no recorded payment to refund — investigate before cancelling.',
        );
      }

      await this.stripeService.refundPayment(order.stripePaymentIntentId);
    }

    order.status = TagOrderStatus.CANCELLED;

    await order.save();

    await this.activityService.log(
      actorId,
      'tag-order.cancelled',
      order._id.toString(),
      { refunded: wasPaid },
    );

    return order;
  }

  // Feeds the admin dashboard's commerce widget.
  async adminRevenueSummary() {
    const [statusCounts, revenue] = await Promise.all([
      this.tagOrderModel.aggregate<{ _id: TagOrderStatus; count: number }>([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      // Revenue is recognized on PAID (money actually collected), regardless
      // of whether fulfillment has happened yet — a CANCELLED-after-refund
      // order is excluded since the money was given back.
      this.tagOrderModel.aggregate<{ _id: null; totalCents: number }>([
        {
          $match: {
            status: { $in: [TagOrderStatus.PAID, TagOrderStatus.FULFILLED] },
          },
        },
        { $group: { _id: null, totalCents: { $sum: '$totalAmountCents' } } },
      ]),
    ]);

    const countByStatus = Object.fromEntries(
      Object.values(TagOrderStatus).map((status) => [status, 0]),
    ) as Record<TagOrderStatus, number>;

    for (const row of statusCounts) {
      countByStatus[row._id] = row.count;
    }

    return {
      countByStatus,
      totalRevenueCents: revenue[0]?.totalCents ?? 0,
      currency: this.configService.get<string>('stripe.currency', 'usd'),
    };
  }

  // Same shape/pattern as PetsService.monthlyRegistrations() — a 12-slot
  // array indexed by calendar month, this year only.
  async monthlyRevenue(): Promise<number[]> {
    const months: number[] = new Array<number>(12).fill(0);

    const orders = (await this.tagOrderModel
      .find({
        status: { $in: [TagOrderStatus.PAID, TagOrderStatus.FULFILLED] },
      })
      .select('totalAmountCents paidAt')
      .lean()
      .exec()) as Array<{ totalAmountCents: number; paidAt?: Date }>;

    orders.forEach((order) => {
      if (order.paidAt) {
        months[new Date(order.paidAt).getMonth()] += order.totalAmountCents;
      }
    });

    return months;
  }
}
