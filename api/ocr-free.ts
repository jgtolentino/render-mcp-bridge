import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cors } from './_cors';

const OCRSPACE_API_KEY = process.env.OCRSPACE_API_KEY || 'K87899142388957'; // Free tier key

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  try {
    // Get image URL or file from request
    const { imageUrl, base64Image } = req.body || {};

    if (!imageUrl && !base64Image) {
      return res.status(400).json({
        ok: false,
        error: 'missing_image',
        detail: 'Provide either imageUrl or base64Image'
      });
    }

    // Prepare form data for OCR.space API
    const formData = new FormData();
    formData.append('apikey', OCRSPACE_API_KEY);
    formData.append('language', 'eng');
    formData.append('isOverlayRequired', 'true'); // Get word positions
    formData.append('OCREngine', '2'); // Use OCR Engine 2 for better accuracy

    if (imageUrl) {
      formData.append('url', imageUrl);
    } else if (base64Image) {
      formData.append('base64Image', base64Image);
    }

    // Call OCR.space API
    const ocrResponse = await fetch('https://api.ocr.space/parse/image', {
      method: 'POST',
      body: formData
    });

    if (!ocrResponse.ok) {
      return res.status(ocrResponse.status).json({
        ok: false,
        error: 'ocr_api_failed',
        detail: await ocrResponse.text()
      });
    }

    const ocrResult = await ocrResponse.json();

    // Check for OCR errors
    if (!ocrResult.IsErroredOnProcessing && ocrResult.ParsedResults && ocrResult.ParsedResults.length > 0) {
      const parsedResult = ocrResult.ParsedResults[0];

      // Convert to our expected format (similar to PaddleOCR output)
      const words = parsedResult.TextOverlay?.Lines?.flatMap((line: any) =>
        line.Words?.map((word: any) => ({
          text: word.WordText,
          confidence: word.Confidence / 100, // Convert 0-100 to 0-1
          box: [
            [word.Left, word.Top],
            [word.Left + word.Width, word.Top],
            [word.Left + word.Width, word.Top + word.Height],
            [word.Left, word.Top + word.Height]
          ]
        }))
      ) || [];

      return res.status(200).json({
        ok: true,
        doc: {
          words: words,
          text: parsedResult.ParsedText,
          confidence: parsedResult.FileParseExitCode === 1 ? 0.9 : 0.7
        }
      });
    } else {
      return res.status(500).json({
        ok: false,
        error: 'ocr_processing_failed',
        detail: ocrResult.ErrorMessage || ocrResult.ErrorDetails
      });
    }
  } catch (error: any) {
    console.error('OCR error:', error);
    return res.status(500).json({
      ok: false,
      error: 'internal_error',
      detail: String(error)
    });
  }
}
