/**
 * Instant Receipt OCR API Route
 * Processes uploaded receipt image and returns extracted fields immediately
 */
import { createClient } from '@supabase/supabase-js';

const OCR_UNIFIED_URL = process.env.OCR_UNIFIED_URL || 'http://localhost:8080';

export async function POST(req: Request) {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const receiptId = formData.get('receipt_id') as string;

    if (!file) {
      return new Response(
        JSON.stringify({ ok: false, error: 'No file provided' }),
        { status: 400, headers: { 'content-type': 'application/json' } }
      );
    }

    // Step 1: Upload to Supabase Storage
    const fileName = `${Date.now()}-${file.name}`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('receipts')
      .upload(fileName, file);

    if (uploadError) {
      return new Response(
        JSON.stringify({ ok: false, error: `Upload failed: ${uploadError.message}` }),
        { status: 500, headers: { 'content-type': 'application/json' } }
      );
    }

    const storagePath = uploadData.path;

    // Step 2: Get signed URL for OCR service
    const { data: signedData, error: signedError } = await supabase.storage
      .from('receipts')
      .createSignedUrl(storagePath, 600);

    if (signedError || !signedData) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Failed to create signed URL' }),
        { status: 500, headers: { 'content-type': 'application/json' } }
      );
    }

    // Step 3: Call unified OCR service (OCR + extraction in one call)
    const imageBlob = await fetch(signedData.signedUrl).then(r => r.blob());
    const ocrFormData = new FormData();
    ocrFormData.append('file', imageBlob, 'receipt.jpg');
    ocrFormData.append('doc_id', receiptId || storagePath);

    const ocrResponse = await fetch(`${OCR_UNIFIED_URL}/process`, {
      method: 'POST',
      body: ocrFormData
    });

    if (!ocrResponse.ok) {
      return new Response(
        JSON.stringify({ ok: false, error: `OCR processing failed: ${ocrResponse.statusText}` }),
        { status: 500, headers: { 'content-type': 'application/json' } }
      );
    }

    const result = await ocrResponse.json();

    // Step 4: Save to database
    const { data: savedData, error: saveError } = await supabase
      .from('te.receipt_ocr')
      .upsert({
        receipt_id: receiptId || null,
        storage_path: storagePath,
        ocr_text: result.ocr_text,
        merchant: result.merchant,
        date: result.date,
        total: result.total,
        tax: result.tax,
        currency: result.currency,
        confidence: result.confidence,
        grounding: result.grounding,
        status: result.status,
        processed_at: new Date().toISOString()
      })
      .select()
      .single();

    if (saveError) {
      console.error('Save error:', saveError);
    }

    // Return instant results
    return new Response(
      JSON.stringify({
        ok: true,
        storage_path: storagePath,
        ocr: {
          text: result.ocr_text,
          confidence: result.ocr_confidence
        },
        extracted: {
          merchant: result.merchant,
          date: result.date,
          total: result.total,
          tax: result.tax,
          currency: result.currency,
          status: result.status,
          confidence: result.confidence
        },
        grounding: result.grounding
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' }
      }
    );

  } catch (error: any) {
    console.error('OCR API Error:', error);
    return new Response(
      JSON.stringify({ ok: false, error: error.message || 'Internal server error' }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    );
  }
}

// GET endpoint to retrieve OCR results
export async function GET(req: Request) {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    const url = new URL(req.url);
    const receiptId = url.searchParams.get('receipt_id');

    if (!receiptId) {
      return new Response(
        JSON.stringify({ ok: false, error: 'receipt_id required' }),
        { status: 400, headers: { 'content-type': 'application/json' } }
      );
    }

    const { data, error } = await supabase
      .from('te.receipt_ocr')
      .select('*')
      .eq('receipt_id', receiptId)
      .single();

    if (error) {
      return new Response(
        JSON.stringify({ ok: false, error: error.message }),
        { status: 404, headers: { 'content-type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ ok: true, data }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    );

  } catch (error: any) {
    return new Response(
      JSON.stringify({ ok: false, error: error.message }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    );
  }
}
