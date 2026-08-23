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
  // Inverse of getUrl() — deletes whatever object a previously-stored URL
  // points to. No-ops (rather than throwing) when the URL doesn't match this
  // provider's own URL shape, so callers can pass a possibly-empty/foreign
  // field value without checking it first.
  deleteByUrl(url: string): Promise<void>;
}
