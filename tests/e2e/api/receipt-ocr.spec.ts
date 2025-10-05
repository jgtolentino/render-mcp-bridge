/**
 * Receipt OCR API Tests
 * Validates instant OCR processing and field extraction
 */
import { test, expect, request } from '@playwright/test';

const API_BASE = process.env.API_BASE_URL || 'http://localhost:3000';
const OCR_UNIFIED = process.env.OCR_UNIFIED_URL || 'http://localhost:8080';

test.describe('@api Receipt OCR Pipeline', () => {
  test('Unified OCR service health check', async () => {
    const ctx = await request.newContext();
    const res = await ctx.get(`${OCR_UNIFIED}/health`);

    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.service).toBe('ocr-unified');
    expect(data).toHaveProperty('lang');
    expect(data).toHaveProperty('auth_enabled');
  });

  test('Instant OCR API endpoint exists', async () => {
    const ctx = await request.newContext({ baseURL: API_BASE });

    // Test that endpoint exists (even if it needs a file)
    const res = await ctx.post('/api/receipts/instant-ocr');

    // Should fail with 400 (no file), not 404 (not found)
    expect(res.status()).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('file');
  });

  test('OCR processing completes within SLA', async () => {
    const ctx = await request.newContext();

    // Create minimal test image (1x1 white pixel PNG)
    const testImage = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
      'base64'
    );

    const startTime = Date.now();

    const res = await ctx.post(`${OCR_UNIFIED}/process`, {
      multipart: {
        file: {
          name: 'test.png',
          mimeType: 'image/png',
          buffer: testImage,
        },
      },
    });

    const endTime = Date.now();
    const duration = endTime - startTime;

    expect(res.ok()).toBeTruthy();
    expect(duration).toBeLessThan(5000); // Should complete in <5 seconds
  });

  test('Process endpoint returns valid response structure', async () => {
    const ctx = await request.newContext();

    const testImage = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
      'base64'
    );

    const res = await ctx.post(`${OCR_UNIFIED}/process`, {
      multipart: {
        file: {
          name: 'test.png',
          mimeType: 'image/png',
          buffer: testImage,
        },
        doc_id: 'test-123',
      },
    });

    expect(res.ok()).toBeTruthy();
    const json = await res.json();

    // Validate response structure
    expect(json).toHaveProperty('merchant');
    expect(json).toHaveProperty('date');
    expect(json).toHaveProperty('total');
    expect(json).toHaveProperty('currency');
    expect(json).toHaveProperty('confidence');
    expect(json).toHaveProperty('status');
    expect(json).toHaveProperty('ocr_text');
    expect(json).toHaveProperty('grounding');
  });

  test('Invalid file type returns 400', async () => {
    const ctx = await request.newContext();
    const textFile = Buffer.from('This is not an image');

    const res = await ctx.post(`${OCR_UNIFIED}/process`, {
      multipart: {
        file: {
          name: 'test.txt',
          mimeType: 'text/plain',
          buffer: textFile,
        },
      },
    });

    expect(res.status()).toBe(400);
    const json = await res.json();
    expect(json.detail).toContain('Invalid image');
  });
});
