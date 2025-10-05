# UAT — Instant Receipt OCR (v1)

**Scope:** Upload → OCR → Extract → Persist → Display (merchant, date, total, tax + grounding)

## Preconditions

- API base: `https://api.w9studio.net` (or your Render URL)
- UI base: `https://jgtolentino.github.io/concur-ui-revive`
- Storage `receipts/` has at least 1 test image (or upload in UI)
- OAuth enabled; tester has login credentials

## Test Cases

### UAT-001: Upload & Process (Happy Path)

**Steps:**
1. Login to UI and open **Receipts** page
2. Upload `sample_receipt.jpg`
3. Observe processing spinner (should complete ≤ 5 seconds)
4. Verify result panel displays:
   - `merchant` (non-empty string)
   - `date` (ISO format: yyyy-mm-dd)
   - `total` (decimal number, e.g., 45.20)
   - `tax` (decimal number or null)
   - `confidence` score ≥ 0.70
5. Toggle grounding boxes overlay
6. Verify bounding boxes appear over extracted fields

**Pass Criteria:**
- ✅ All fields populated correctly
- ✅ Status shows "extracted"
- ✅ Confidence ≥ 70%
- ✅ Grounding boxes align with text on receipt image

**Screenshot:** Attach annotated screenshot showing successful extraction

---

### UAT-002: Needs Review (Low Quality)

**Steps:**
1. Upload a blurred/angled/low-quality receipt image
2. Observe processing completes
3. Verify status shows "needs_review"
4. Verify missing fields are highlighted
5. Manually edit a missing field (e.g., merchant name)
6. Click "Save" button
7. Refresh the page and verify edited value persists

**Pass Criteria:**
- ✅ Status correctly shows "needs_review"
- ✅ Missing/low-confidence fields highlighted
- ✅ Manual edits save successfully
- ✅ Edited values persist after refresh

**Screenshot:** Attach before/after editing

---

### UAT-003: Security (Direct OCR Block)

**Steps:**
1. Open browser DevTools (F12)
2. Attempt direct POST to OCR service:
   ```bash
   fetch('https://ocr-unified.onrender.com/process', {
     method: 'POST',
     body: formData
   })
   ```
3. Verify request is blocked

**Pass Criteria:**
- ✅ Returns 401/403 Unauthorized
- ✅ OCR service requires Basic Auth (not accessible from browser)
- ✅ Only API backend can call OCR service

**Evidence:** Screenshot of network tab showing 401/403 response

---

### UAT-004: API Contract Validation

**Steps:**
1. Call API endpoint with valid payload:
   ```bash
   curl -X POST https://api.w9studio.net/api/receipts/instant-ocr \
     -H 'Content-Type: application/json' \
     -H 'Authorization: Bearer <jwt>' \
     -d '{
       "file": "<base64-image>",
       "receipt_id": "test-123"
     }'
   ```
2. Verify response structure

**Expected Response:**
```json
{
  "ok": true,
  "storage_path": "receipts/12345.jpg",
  "ocr": {
    "text": "Full extracted text...",
    "confidence": 0.92
  },
  "extracted": {
    "merchant": "Acme Store",
    "date": "2024-10-05",
    "total": 45.99,
    "tax": 3.68,
    "currency": "USD",
    "status": "extracted",
    "confidence": 95.5
  },
  "grounding": {
    "merchant": [[x,y,w,h]],
    "date": [[x,y,w,h]],
    "total": [[x,y,w,h]]
  }
}
```

**Pass Criteria:**
- ✅ HTTP 200 status
- ✅ `ok: true`
- ✅ All expected fields present and non-null
- ✅ Grounding coordinates valid

**Evidence:** Paste curl response JSON

---

### UAT-005: RLS (Row Level Security)

**Steps:**
1. Login as **User A**
2. Upload receipt and note the `receipt_id`
3. Logout
4. Login as **User B** (different user, no admin/finance role)
5. Attempt to access User A's receipt via:
   - Direct URL: `/receipts/{receipt_id}`
   - API call with User B's JWT
6. Verify access is denied

**Pass Criteria:**
- ✅ User B cannot see User A's receipt in UI
- ✅ API returns 404 or 403 for User B
- ✅ RLS policies enforce user isolation

**Evidence:** Screenshot showing "Not Found" or "Forbidden" message

---

### UAT-006: International Currency

**Steps:**
1. Upload receipt with non-USD currency symbols:
   - PHP (₱): Philippine Peso receipt
   - EUR (€): Euro receipt
   - JPY (¥): Japanese Yen receipt
2. Verify extraction

**Expected Results:**
- ✅ `currency` field correctly detected (PHP, EUR, JPY)
- ✅ `total` amount parsed correctly (accounting for decimal separators)
- ✅ Currency symbol appears in UI display

**Pass Criteria:**
- ✅ Supported currencies detected: USD, PHP, EUR, JPY
- ✅ Total amount formatted with correct currency symbol

**Screenshot:** Attach for each currency test

---

### UAT-007: OAuth Authentication

**Steps:**
1. Navigate to login page
2. Click "Sign in with Google" (or Okta)
3. Complete OAuth flow
4. If Okta: Complete MFA challenge (SMS/Push/TOTP)
5. Verify redirect to `/auth/callback`
6. Verify auto-redirect to `/dashboard`
7. Verify session persists across page refresh

**Pass Criteria:**
- ✅ OAuth redirect completes successfully
- ✅ MFA challenge works (if Okta)
- ✅ User provisioned in `te.users` table
- ✅ Session persists after refresh
- ✅ User can access protected routes

**Evidence:** Screenshot showing successful dashboard access

---

### UAT-008: Upload Multiple Receipts

**Steps:**
1. Upload 3 different receipts in quick succession
2. Verify all process correctly
3. Check database for 3 separate records

**Pass Criteria:**
- ✅ All 3 receipts process without errors
- ✅ Each receipt has unique `id` and `storage_path`
- ✅ No race conditions or overwrites
- ✅ All records visible in UI receipt list

**Evidence:** Screenshot of receipt list showing all 3 items

---

### UAT-009: Error Handling

**Steps:**
1. Attempt to upload invalid file (e.g., .txt, .pdf, .exe)
2. Verify graceful error handling
3. Upload image >10MB
4. Verify file size validation

**Pass Criteria:**
- ✅ Invalid file type rejected with clear message
- ✅ File size limit enforced (10MB max)
- ✅ Error messages user-friendly (not stack traces)
- ✅ UI remains functional after error

**Evidence:** Screenshots of error messages

---

### UAT-010: Performance Benchmarking

**Steps:**
1. Upload standard quality receipt (200-500KB JPG)
2. Measure time from upload click to results display
3. Repeat 5 times and calculate average

**Expected Performance:**
- OCR processing: < 2 seconds
- Total end-to-end: < 3 seconds
- 95th percentile: < 5 seconds

**Pass Criteria:**
- ✅ Average processing time < 3 seconds
- ✅ No timeouts on standard receipts
- ✅ Spinner provides feedback during processing

**Evidence:** Timing data from browser DevTools Network tab

---

## Exit Criteria

### Must Pass (Blocking)
- ✅ 100% pass for UAT-001, UAT-002, UAT-003, UAT-004
- ✅ UAT-005 (RLS) must pass
- ✅ UAT-007 (OAuth) must pass
- ✅ 0 critical defects
- ✅ ≤ 2 minor defects

### Should Pass (Non-Blocking)
- UAT-006: International currency (for supported locales only)
- UAT-008: Concurrent uploads
- UAT-009: Error handling
- UAT-010: Performance benchmarks

## Defect Severity Classification

### Critical (P0)
- Security vulnerabilities (RLS bypass, auth bypass)
- Data loss or corruption
- Service completely unavailable

### High (P1)
- OCR extraction fails >30% of time
- UI dead-ends or broken flows
- Performance >2x slower than expected

### Medium (P2)
- Incorrect field extraction (but manual edit works)
- UI/UX issues not blocking workflow
- Missing non-critical features

### Low (P3)
- Cosmetic issues
- Enhancement requests
- Edge cases with workarounds

## Sign-Off

| Role | Name | Date | Status |
|------|------|------|--------|
| QA Lead | _______ | _______ | ☐ Pass ☐ Fail |
| Product Owner | _______ | _______ | ☐ Approved ☐ Rejected |
| Tech Lead | _______ | _______ | ☐ Approved ☐ Rejected |

**Notes:**
_Record any deviations, issues, or observations here_

---

## Appendix: Test Data

### Sample Receipts
- `sample_receipt.jpg` - Standard English receipt (USD)
- `sample_receipt_ph.jpg` - Philippine receipt (PHP)
- `sample_receipt_blurred.jpg` - Low quality test case
- `sample_receipt_angled.jpg` - Rotated receipt test

### Test Users
- `test-user-1@company.com` - Standard employee
- `test-user-2@company.com` - Different employee (for RLS test)
- `finance@company.com` - Finance role user
- `approver@company.com` - Approver role user

### Environment URLs
- **Production**: https://jgtolentino.github.io/concur-ui-revive
- **API**: https://api.w9studio.net
- **OCR Service**: https://ocr-unified.onrender.com (internal only)
