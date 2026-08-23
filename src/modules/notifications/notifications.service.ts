import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { MailerService } from '@nestjs-modules/mailer';
import { Model, Types } from 'mongoose';

import {
  Notification,
  NotificationDocument,
} from './schemas/notification.schema';
import { NotificationQueryDto } from './dto/notification-query.dto';
import { renderPlainTextTemplate } from '../../mail/mail-template.util';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly mailerService: MailerService,

    @InjectModel(Notification.name)
    private readonly notificationModel: Model<NotificationDocument>,
  ) {}

  async sendEmail(to: string, subject: string, message: string) {
    await this.mailerService.sendMail({
      to,
      subject,
      html: `
        <h2>${subject}</h2>

        <p>${message}</p>

        <hr>

        <small>
          Pawtato Pet Management System
        </small>
      `,
    });

    return true;
  }

  // Renders a named .hbs template (via MailerModule's HandlebarsAdapter) for
  // the HTML body, plus its .txt sibling for the plain-text alternative —
  // used by the auth flows (verify-email, forgot-password, password-reset).
  async sendTemplateEmail(
    to: string,
    subject: string,
    template: string,
    context: Record<string, unknown>,
  ) {
    await this.mailerService.sendMail({
      to,
      subject,
      template,
      context,
      text: renderPlainTextTemplate(template, context),
    });

    return true;
  }

  async create(
    userId: string,
    type: string,
    title: string,
    message: string,
    data?: Record<string, unknown>,
  ) {
    return this.notificationModel.create({
      user: new Types.ObjectId(userId),
      type,
      title,
      message,
      data,
    });
  }

  async findForUser(userId: string, query: NotificationQueryDto) {
    const { page, limit, unreadOnly } = query;

    const filter: { user: Types.ObjectId; readAt?: null } = {
      user: new Types.ObjectId(userId),
    };

    if (unreadOnly) {
      filter.readAt = null;
    }

    const total = await this.notificationModel.countDocuments(filter);

    const notifications = await this.notificationModel
      .find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    return {
      notifications,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async markRead(userId: string, notificationId: string) {
    const notification = await this.notificationModel.findOneAndUpdate(
      { _id: notificationId, user: new Types.ObjectId(userId) },
      { readAt: new Date() },
      { new: true },
    );

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    return notification;
  }
}
