import * as fs from 'fs';
import * as path from 'path';

import { LocalDiskStorageProvider } from './local-disk-storage.provider';

jest.mock('fs', () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  promises: {
    writeFile: jest.fn(),
    unlink: jest.fn(),
  },
}));

describe('LocalDiskStorageProvider', () => {
  let provider: LocalDiskStorageProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    provider = new LocalDiskStorageProvider();
  });

  describe('upload', () => {
    it('creates the destination folder when it does not exist', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      await provider.upload({
        buffer: Buffer.from('data'),
        folder: 'avatars',
        originalName: 'photo.png',
        mimetype: 'image/png',
      });

      expect(fs.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('avatars'),
        { recursive: true },
      );
    });

    it('skips folder creation when it already exists', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);

      await provider.upload({
        buffer: Buffer.from('data'),
        folder: 'avatars',
        originalName: 'photo.png',
        mimetype: 'image/png',
      });

      expect(fs.mkdirSync).not.toHaveBeenCalled();
    });

    it('uses an explicit filename verbatim when provided', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);

      const key = await provider.upload({
        buffer: Buffer.from('data'),
        folder: 'qrcodes',
        originalName: 'ABC123.png',
        mimetype: 'image/png',
        filename: 'ABC123.png',
      });

      expect(key).toBe('qrcodes/ABC123.png');
      expect(fs.promises.writeFile).toHaveBeenCalledWith(
        path.join(process.cwd(), 'uploads', 'qrcodes', 'ABC123.png'),
        Buffer.from('data'),
      );
    });

    it('generates a random unique filename when none is given', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);

      const key = await provider.upload({
        buffer: Buffer.from('data'),
        folder: 'avatars',
        originalName: 'my photo.jpg',
        mimetype: 'image/jpeg',
      });

      expect(key).toMatch(/^avatars\/\d+-[0-9a-f-]{36}\.jpg$/);
    });
  });

  describe('getUrl', () => {
    it('prefixes the key with /uploads/', () => {
      expect(provider.getUrl('avatars/foo.png')).toBe(
        '/uploads/avatars/foo.png',
      );
    });
  });

  describe('delete', () => {
    it('unlinks the file at the resolved path', async () => {
      (fs.promises.unlink as jest.Mock).mockResolvedValue(undefined);

      await provider.delete('avatars/foo.png');

      expect(fs.promises.unlink).toHaveBeenCalledWith(
        path.join(process.cwd(), 'uploads', 'avatars', 'foo.png'),
      );
    });

    it('swallows ENOENT errors', async () => {
      const error = Object.assign(new Error('not found'), {
        code: 'ENOENT',
      });

      (fs.promises.unlink as jest.Mock).mockRejectedValue(error);

      await expect(
        provider.delete('avatars/missing.png'),
      ).resolves.toBeUndefined();
    });

    it('rethrows non-ENOENT errors', async () => {
      const error = Object.assign(new Error('permission denied'), {
        code: 'EACCES',
      });

      (fs.promises.unlink as jest.Mock).mockRejectedValue(error);

      await expect(provider.delete('avatars/foo.png')).rejects.toThrow(
        'permission denied',
      );
    });
  });
});
