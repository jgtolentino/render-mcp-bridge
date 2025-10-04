/**
 * E2E Tests for Instant Receipt OCR Pipeline
 */
import { test, expect, request } from '@playwright/test';

const API_BASE = process.env.API_BASE_URL || 'http://localhost:3000';
const OCR_BASE = process.env.OCR_BASE_URL;
const EXTRACT_BASE = process.env.EXTRACT_BASE_URL;

test.describe('@api Receipt OCR Pipeline', () => {
  test('OCR service health check', async () => {
    test.skip(!OCR_BASE, 'OCR_BASE_URL not set');

    const ctx = await request.newContext({ baseURL: OCR_BASE });
    const res = await ctx.get('/health');

    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.service).toBe('ocr');
  });

  test('Extract service health check', async () => {
    test.skip(!EXTRACT_BASE, 'EXTRACT_BASE_URL not set');

    const ctx = await request.newContext({ baseURL: EXTRACT_BASE });
    const res = await ctx.get('/health');

    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.service).toBe('extract');
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

  test.skip('Complete OCR pipeline with sample receipt', async () => {
    // This test requires a sample receipt image
    // Skip by default, run manually with: npx playwright test --grep="Complete OCR"

    const ctx = await request.newContext({ baseURL: API_BASE });

    // TODO: Add sample receipt image to tests/fixtures/
    // const file = fs.readFileSync('tests/fixtures/sample-receipt.jpg');

    const res = await ctx.post('/api/receipts/instant-ocr', {
      multipart: {
        file: {
          name: 'receipt.jpg',
          mimeType: 'image/jpeg',
          buffer: Buffer.from('') // Replace with actual image buffer
        }
      }
    });

    expect(res.ok()).toBeTruthy();
    const data = await res.json();

    expect(data.ok).toBe(true);
    expect(data.storage_path).toBeTruthy();
    expect(data.extracted).toBeTruthy();
    expect(data.extracted.confidence).toBeGreaterThanOrEqual(0);
    expect(data.extracted.confidence).toBeLessThanOrEqual(100);
  });
});

test.describe('@integration Receipt OCR Database', () => {
  test('receipt_ocr table exists', async () => {
    // This would require direct database access
    // For now, just verify through API that table is accessible
    test.skip(true, 'Requires database credentials');
  });
});
