export interface StorageUploadInput {
  buffer: Buffer;
  folder: string;
  originalName: string;
  mimetype: string;
  // Explicit filename to store under (used as-is). Omit to get a random,
  // collision-safe name derived from originalName's extension.
  filename?: string;
}

export interface StorageProvider {
  upload(input: StorageUploadInput): Promise<string>;
  getUrl(key: string): string;
  delete(key: string): Promise<void>;
}
