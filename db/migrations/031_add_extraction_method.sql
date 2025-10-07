-- Add extraction_method to receipt_ocr table
-- Date: 2025-10-05

BEGIN;

ALTER TABLE te.receipt_ocr
ADD COLUMN IF NOT EXISTS extraction_method TEXT;

COMMENT ON COLUMN te.receipt_ocr.extraction_method IS 'The method used for extraction, e.g., ''rules'', ''llm_multimodal''.';

COMMIT;
