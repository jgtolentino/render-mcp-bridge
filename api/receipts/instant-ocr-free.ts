import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sv } from '../_supabase';
import { cors } from '../_cors';

async function signedUrlFromStoragePath(path: string): Promise<string | null> {
  if (/^https?:\/\//i.test(path)) return path;
  const [bucket, ...rest] = path.split('/');
  if (!bucket || rest.length === 0) return null;
  const key = rest.join('/');
  const client = sv();
  const { data, error } = await client.storage.from(bucket).createSignedUrl(key, 60);
  if (error) return null;
  return data?.signedUrl ?? null;
}

async function ocrWithOCRSpace(imageUrl: string) {
  const OCRSPACE_API_KEY = process.env.OCRSPACE_API_KEY || 'K87899142388957'; // Free tier

  const formData = new FormData();
  formData.append('apikey', OCRSPACE_API_KEY);
  formData.append('url', imageUrl);
  formData.append('language', 'eng');
  formData.append('isOverlayRequired', 'true');
  formData.append('OCREngine', '2');
  formData.append('filetype', 'JPG'); // Specify file type explicitly

  const response = await fetch('https://api.ocr.space/parse/image', {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    throw new Error(`OCR.space API failed: ${response.statusText}`);
  }

  const result = await response.json();

  if (result.IsErroredOnProcessing || !result.ParsedResults || result.ParsedResults.length === 0) {
    throw new Error(result.ErrorMessage || 'OCR processing failed');
  }

  const parsedResult = result.ParsedResults[0];

  // Convert to our expected format
  const words = parsedResult.TextOverlay?.Lines?.flatMap((line: any) =>
    line.Words?.map((word: any) => ({
      text: word.WordText,
      confidence: word.Confidence / 100,
      box: [
        [word.Left, word.Top],
        [word.Left + word.Width, word.Top],
        [word.Left + word.Width, word.Top + word.Height],
        [word.Left, word.Top + word.Height]
      ]
    }))
  ) || [];

  return {
    doc: {
      words: words,
      text: parsedResult.ParsedText,
      confidence: parsedResult.FileParseExitCode === 1 ? 0.9 : 0.7
    }
  };
}

// Simple field extraction (same logic as Render service)
function extractFields(doc: any) {
  const text = doc.text || doc.words?.map((w: any) => w.text).join(' ') || '';
  const words = doc.words || [];

  // Extract merchant (first few words)
  const merchant = words.slice(0, 3).map((w: any) => w.text).join(' ') || null;

  // Extract date
  const dateMatch = text.match(/\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b/);
  const date = dateMatch ? dateMatch[0] : null;

  // Extract total (largest money amount)
  const moneyMatches = text.matchAll(/(?:USD|PHP|₱|\$)?\s*([0-9]+[,.]?[0-9]{2})/g);
  const amounts = Array.from(moneyMatches).map(m => parseFloat(m[1].replace(',', '')));
  const total = amounts.length > 0 ? Math.max(...amounts) : null;

  // Extract currency
  const currency = /\$|USD/.test(text) ? 'USD' : /₱|PHP/.test(text) ? 'PHP' : 'USD';

  // Calculate confidence
  const confidence = [merchant, date, total].filter(Boolean).length / 3 * 100;
  const status = confidence >= 80 ? 'extracted' : 'needs_review';

  return {
    ok: true,
    data: {
      merchant,
      date,
      total,
      tax: null,
      currency,
      confidence: Math.round(confidence),
      status,
      ocr_text: text,
      ocr_confidence: doc.confidence || 0.9
    }
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ ok: false, error: 'method_not_allowed' });
    }

    const { storage_path, schema_name = 'receipt_v1', user_id } = req.body || {};
    if (!storage_path || !user_id) {
      return res.status(400).json({ ok: false, error: 'missing storage_path or user_id' });
    }

    // Get signed URL from Supabase storage
    const imageUrl = await signedUrlFromStoragePath(storage_path);
    if (!imageUrl) {
      return res.status(400).json({ ok: false, error: 'signed_url_failed' });
    }

    // Run OCR
    const ocrResult = await ocrWithOCRSpace(imageUrl);

    // Extract fields
    const extracted = extractFields(ocrResult.doc);

    return res.status(200).json(extracted);
  } catch (e: any) {
    console.error('Instant OCR error:', e);
    return res.status(500).json({
      ok: false,
      error: 'internal_error',
      detail: String(e)
    });
  }
}
