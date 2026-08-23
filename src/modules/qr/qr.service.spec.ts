import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { QrService } from './qr.service';
import { STORAGE_PROVIDER } from '../storage/storage.constants';

describe('QrService', () => {
  let service: QrService;
  let storageProvider: { upload: jest.Mock; getUrl: jest.Mock };

  beforeEach(async () => {
    storageProvider = {
      upload: jest.fn().mockResolvedValue('qrcodes/ABC123.png'),
      getUrl: jest.fn().mockReturnValue('/uploads/qrcodes/ABC123.png'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QrService,
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('http://localhost:5000') },
        },
        { provide: STORAGE_PROVIDER, useValue: storageProvider },
      ],
    }).compile();

    service = module.get<QrService>(QrService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generate', () => {
    it('uploads a PNG buffer under a deterministic filename and returns the resolved URL', async () => {
      const url = await service.generate('ABC123');

      expect(storageProvider.upload).toHaveBeenCalledWith(
        expect.objectContaining({
          folder: 'qrcodes',
          filename: 'ABC123.png',
          originalName: 'ABC123.png',
          mimetype: 'image/png',
          buffer: expect.any(Buffer) as Buffer,
        }),
      );
      expect(storageProvider.getUrl).toHaveBeenCalledWith('qrcodes/ABC123.png');
      expect(url).toBe('/uploads/qrcodes/ABC123.png');
    });
  });
});
