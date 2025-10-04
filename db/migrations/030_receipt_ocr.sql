-- Receipt OCR Results Table
-- Stores instant OCR extraction results for receipts
-- Date: 2025-10-05

BEGIN;

-- Create receipt_ocr table to store extraction results
CREATE TABLE IF NOT EXISTS te.receipt_ocr (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  receipt_id UUID REFERENCES te.receipts(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  ocr_text TEXT,                                 -- Full extracted text
  merchant TEXT,
  date DATE,
  total NUMERIC(18,2),
  tax NUMERIC(18,2),
  currency TEXT DEFAULT 'USD',
  confidence NUMERIC(5,2),                       -- 0-100
  grounding JSONB,                               -- {"merchant":[[x,y]...],"total":[[x,y]...]}
  status TEXT NOT NULL CHECK (status IN ('processing','extracted','failed','needs_review')) DEFAULT 'processing',
  error_message TEXT,
  processed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(receipt_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_receipt_ocr_receipt ON te.receipt_ocr(receipt_id);
CREATE INDEX IF NOT EXISTS idx_receipt_ocr_status ON te.receipt_ocr(status);
CREATE INDEX IF NOT EXISTS idx_receipt_ocr_date ON te.receipt_ocr(processed_at DESC);

-- Enable RLS
ALTER TABLE te.receipt_ocr ENABLE ROW LEVEL SECURITY;

-- Policy: Users can see their own OCR results
DROP POLICY IF EXISTS p_receipt_ocr_own ON te.receipt_ocr;
CREATE POLICY p_receipt_ocr_own ON te.receipt_ocr
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM te.receipts r
      WHERE r.id = receipt_ocr.receipt_id
      AND r.owner_id = auth.uid()
    )
  );

-- Policy: Finance/auditors can see all
DROP POLICY IF EXISTS p_receipt_ocr_finance ON te.receipt_ocr;
CREATE POLICY p_receipt_ocr_finance ON te.receipt_ocr
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM te.employees
      WHERE employees.id = auth.uid()
      AND employees.role IN ('finance', 'auditor')
    )
  );

-- Policy: Service role can insert/update (for API)
DROP POLICY IF EXISTS p_receipt_ocr_service ON te.receipt_ocr;
CREATE POLICY p_receipt_ocr_service ON te.receipt_ocr
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Verification
SELECT
  'te.receipt_ocr' as table_name,
  COUNT(*) as rows,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name='receipt_ocr' AND table_schema='te') as columns
FROM te.receipt_ocr;

COMMIT;
