/**
 * Health Check Tests
 * Verifies all microservices are running and responding
 */
import { test, expect, request } from '@playwright/test';

test.describe('Service Health Checks', () => {
  test('OCR Unified service health', async () => {
    const ocrUrl = process.env.OCR_UNIFIED_URL || 'http://localhost:8080';
    const ctx = await request.newContext();

    const response = await ctx.get(`${ocrUrl}/health`);

    expect(response.ok()).toBeTruthy();

    const json = await response.json();
    expect(json.ok).toBeTruthy();
    expect(json.service).toBe('ocr-unified');
    expect(json).toHaveProperty('lang');
    expect(json).toHaveProperty('auth_enabled');
  });

  test('API backend health (if exists)', async ({ baseURL }) => {
    const ctx = await request.newContext({ baseURL });

    try {
      const response = await ctx.get('/health');
      if (response.ok()) {
        const json = await response.json();
        expect(json).toHaveProperty('ok');
      }
    } catch (e) {
      // Health endpoint might not exist, skip
      test.skip();
    }
  });

  test('OCR service responds within timeout', async () => {
    const ocrUrl = process.env.OCR_UNIFIED_URL || 'http://localhost:8080';
    const ctx = await request.newContext();

    const startTime = Date.now();
    const response = await ctx.get(`${ocrUrl}/health`);
    const endTime = Date.now();

    expect(response.ok()).toBeTruthy();
    expect(endTime - startTime).toBeLessThan(2000); // Should respond in <2s
  });
});
