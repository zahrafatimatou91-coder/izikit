import { describe, it, expect } from 'vitest';
import { validateImageFile, MAX_IMAGE_BYTES } from './validate-image';

function fileOfSize(bytes: number, type: string, name = 'photo'): File {
  return new File([new Uint8Array(bytes)], name, { type });
}

describe('validateImageFile', () => {
  it('accepts a JPEG / PNG / WebP under the size cap', () => {
    expect(validateImageFile(fileOfSize(1024, 'image/jpeg'))).toBeNull();
    expect(validateImageFile(fileOfSize(1024, 'image/png'))).toBeNull();
    expect(validateImageFile(fileOfSize(1024, 'image/webp'))).toBeNull();
  });

  it('rejects a file larger than MAX_IMAGE_BYTES', () => {
    expect(validateImageFile(fileOfSize(MAX_IMAGE_BYTES + 1, 'image/png'))).toBe(
      'Image trop lourde (10 Mo max).',
    );
  });

  it('accepts a file exactly at MAX_IMAGE_BYTES', () => {
    expect(validateImageFile(fileOfSize(MAX_IMAGE_BYTES, 'image/png'))).toBeNull();
  });

  it('rejects an unsupported type (GIF, PDF, HEIC)', () => {
    const msg = 'Format non supporté — choisis un JPEG, PNG ou WebP.';
    expect(validateImageFile(fileOfSize(1024, 'image/gif'))).toBe(msg);
    expect(validateImageFile(fileOfSize(1024, 'application/pdf'))).toBe(msg);
    expect(validateImageFile(fileOfSize(1024, 'image/heic'))).toBe(msg);
  });

  it('rejects a file with no MIME type', () => {
    expect(validateImageFile(fileOfSize(1024, ''))).toBe(
      'Format non supporté — choisis un JPEG, PNG ou WebP.',
    );
  });
});
