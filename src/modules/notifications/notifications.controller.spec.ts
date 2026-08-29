import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { DevicePlatform } from '../../common/enums/device-platform.enum';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

describe('NotificationsController', () => {
  let controller: NotificationsController;
  let notificationsService: {
    registerDeviceToken: jest.Mock;
    unregisterDeviceToken: jest.Mock;
  };

  const user = { sub: 'user-1' } as JwtPayload;

  beforeEach(async () => {
    notificationsService = {
      registerDeviceToken: jest.fn(),
      unregisterDeviceToken: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        { provide: NotificationsService, useValue: notificationsService },
      ],
    }).compile();

    controller = module.get<NotificationsController>(NotificationsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('registerDeviceToken', () => {
    it("delegates to the service with the caller's id", async () => {
      const dto = { token: 'abc', platform: DevicePlatform.WEB };

      await controller.registerDeviceToken(user, dto);

      expect(notificationsService.registerDeviceToken).toHaveBeenCalledWith(
        'user-1',
        dto,
      );
    });
  });

  describe('unregisterDeviceToken', () => {
    it("delegates to the service with the caller's id and the token", async () => {
      await controller.unregisterDeviceToken(user, 'abc');

      expect(notificationsService.unregisterDeviceToken).toHaveBeenCalledWith(
        'user-1',
        'abc',
      );
    });
  });
});
