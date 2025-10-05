import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cors } from './_cors';

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  cors(res);
  res.status(200).json({
    ok: true,
    service: 'api',
    time: new Date().toISOString()
  });
}
