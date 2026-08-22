import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class NotificationsService {
  constructor(private readonly mailerService: MailerService) {}

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
}
