import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sv } from '../_supabase';
import { cors } from '../_cors';

const OCR_BASE_URL = process.env.OCR_BASE_URL!;
const EXTRACT_BASE_URL = process.env.EXTRACT_BASE_URL || OCR_BASE_URL;
const OCR_USER = process.env.OCR_BASIC_USER ?? '';
const OCR_PASS = process.env.OCR_BASIC_PASS ?? '';

function downstreamAuth(): Record<string, string> {
  if (!OCR_USER || !OCR_PASS) return {};
  const token = Buffer.from(`${OCR_USER}:${OCR_PASS}`).toString('base64');
  return { Authorization: `Basic ${token}` };
}

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

    const imageUrl = await signedUrlFromStoragePath(storage_path);
    if (!imageUrl) {
      return res.status(400).json({ ok: false, error: 'signed_url_failed' });
    }

    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) {
      return res.status(400).json({ ok: false, error: 'fetch_image_failed' });
    }

    const buf = Buffer.from(await imgRes.arrayBuffer());
    const form = new FormData();
    const blob = new Blob([buf], {
      type: imgRes.headers.get('content-type') || 'application/octet-stream'
    });
    form.append('file', blob, storage_path.split('/').pop() || 'upload.bin');

    const ocrRes = await fetch(new URL('/ocr', OCR_BASE_URL), {
      method: 'POST',
      headers: { ...downstreamAuth() },
      body: form
    });

    if (!ocrRes.ok) {
      return res.status(ocrRes.status).json({
        ok: false,
        error: 'ocr_failed',
        detail: await ocrRes.text()
      });
    }

    const ocrDoc = await ocrRes.json(); // {doc:{words:[]}}

    const extRes = await fetch(new URL('/extract', EXTRACT_BASE_URL), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...downstreamAuth()
      },
      body: JSON.stringify({ doc: ocrDoc.doc, schema: { name: schema_name } })
    });

    const extText = await extRes.text();
    let payload: any;
    try {
      payload = JSON.parse(extText);
    } catch {
      payload = { ok: false, raw: extText };
    }

    return res.status(200).json({ ok: true, ...payload });
  } catch (e: any) {
    return res.status(500).json({
      ok: false,
      error: 'internal_error',
      detail: String(e)
    });
  }
}
