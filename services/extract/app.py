"""
Instant Receipt Field Extraction Service
Rules-based extraction from OCR output with fuzzy matching
"""
import re
from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dateutil import parser as date_parser
from rapidfuzz import process, fuzz

app = FastAPI(
    title="Extract Service",
    description="Instant receipt field extraction",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Models
class Word(BaseModel):
    text: str
    confidence: float
    box: List[List[float]]

class OcrResult(BaseModel):
    doc_id: str
    text: str
    words: List[Word]
    confidence: float

class ExtractRequest(BaseModel):
    ocr: OcrResult

class ExtractedField(BaseModel):
    name: str
    value: Optional[str]
    confidence: float
    grounding: Optional[List[List[float]]]  # Bounding box

class ExtractResponse(BaseModel):
    merchant: Optional[str]
    date: Optional[str]  # ISO format
    total: Optional[float]
    tax: Optional[float]
    currency: str
    confidence: float
    grounding: Dict[str, List[List[float]]]  # Field -> box mapping
    status: str  # 'extracted', 'needs_review'


def extract_merchant(words: List[Word]) -> Optional[tuple[str, List[List[float]]]]:
    """Extract merchant name (usually first 1-3 lines)"""
    if not words:
        return None

    # Take first 3 words as potential merchant
    merchant_words = words[:min(3, len(words))]
    merchant_text = " ".join([w.text for w in merchant_words])

    # Use the first word's bounding box
    box = merchant_words[0].box if merchant_words else None

    return merchant_text, box


def extract_date(text: str, words: List[Word]) -> Optional[tuple[str, List[List[float]]]]:
    """Extract date using multiple patterns"""
    # Common date patterns
    date_patterns = [
        r'\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b',  # MM/DD/YYYY or DD/MM/YYYY
        r'\b\d{4}[-/]\d{1,2}[-/]\d{1,2}\b',    # YYYY-MM-DD
        r'\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2},? \d{4}\b',  # Month DD, YYYY
    ]

    for pattern in date_patterns:
        matches = re.finditer(pattern, text, re.IGNORECASE)
        for match in matches:
            try:
                # Parse the matched string
                parsed_date = date_parser.parse(match.group(), fuzzy=False)

                # Find corresponding word for grounding
                match_text = match.group()
                for word in words:
                    if match_text in word.text or word.text in match_text:
                        return parsed_date.date().isoformat(), word.box

                return parsed_date.date().isoformat(), None
            except (ValueError, date_parser.ParserError):
                continue

    # Fallback: try each word
    for word in words:
        try:
            parsed_date = date_parser.parse(word.text, fuzzy=False)
            return parsed_date.date().isoformat(), word.box
        except (ValueError, date_parser.ParserError):
            continue

    return None


def extract_money(text: str, words: List[Word], hint: str = "total") -> Optional[tuple[float, List[List[float]]]]:
    """Extract money amount with hint (total, tax, subtotal)"""
    # Money patterns
    patterns = [
        r'(?:USD|PHP|₱|\$)?\s*([0-9]+[,.]?[0-9]{2})',  # $123.45 or PHP 123.45
        r'([0-9]+\.[0-9]{2})\s*(?:USD|PHP|₱|\$)?',    # 123.45 USD
    ]

    # Find all money amounts
    amounts = []
    for pattern in patterns:
        for match in re.finditer(pattern, text, re.IGNORECASE):
            try:
                # Clean and convert
                amount_str = match.group(1) if '(' in pattern else match.group()
                amount_str = amount_str.replace(',', '').replace('$', '').replace('₱', '').replace('PHP', '').replace('USD', '').strip()
                amount = float(amount_str)

                # Find corresponding word
                box = None
                for word in words:
                    if amount_str in word.text or word.text.replace(',', '').replace('$', '') == amount_str:
                        box = word.box
                        break

                amounts.append((amount, box, match.start()))
            except (ValueError, InvalidOperation):
                continue

    if not amounts:
        return None

    # If hint is "total", take the largest amount
    if hint.lower() in ["total", "grand total", "amount"]:
        amounts.sort(key=lambda x: x[0], reverse=True)
        return amounts[0][0], amounts[0][1]

    # If hint is "tax", find word "tax" nearby
    if hint.lower() == "tax":
        for word in words:
            if "tax" in word.text.lower():
                # Find closest amount to this word
                word_text = word.text.lower()
                for amount, box, pos in amounts:
                    return amount, box

    # Default: return first amount
    return amounts[0][0], amounts[0][1]


def extract_currency(text: str) -> str:
    """Detect currency from symbols or text"""
    if '$' in text or 'USD' in text.upper():
        return 'USD'
    elif '₱' in text or 'PHP' in text.upper() or 'PESO' in text.upper():
        return 'PHP'
    elif '¥' in text or 'JPY' in text.upper() or 'YEN' in text.upper():
        return 'JPY'
    elif '€' in text or 'EUR' in text.upper():
        return 'EUR'
    else:
        return 'USD'  # Default


@app.get("/health")
async def health():
    """Health check endpoint"""
    return {
        "ok": True,
        "service": "extract",
        "version": "1.0.0"
    }


@app.post("/extract", response_model=ExtractResponse)
async def extract_fields(req: ExtractRequest):
    """
    Extract structured fields from OCR result

    Returns instant extraction of:
    - merchant (first few lines)
    - date (parsed from common formats)
    - total (largest amount)
    - tax (if "tax" keyword found nearby amount)
    - currency (from symbols/text)
    """
    try:
        ocr = req.ocr
        grounding = {}

        # Extract merchant
        merchant_result = extract_merchant(ocr.words)
        merchant = merchant_result[0] if merchant_result else None
        if merchant_result and merchant_result[1]:
            grounding["merchant"] = merchant_result[1]

        # Extract date
        date_result = extract_date(ocr.text, ocr.words)
        date = date_result[0] if date_result else None
        if date_result and date_result[1]:
            grounding["date"] = date_result[1]

        # Extract total
        total_result = extract_money(ocr.text, ocr.words, hint="total")
        total = total_result[0] if total_result else None
        if total_result and total_result[1]:
            grounding["total"] = total_result[1]

        # Extract tax
        tax_result = extract_money(ocr.text, ocr.words, hint="tax")
        tax = tax_result[0] if tax_result else None
        if tax_result and tax_result[1]:
            grounding["tax"] = tax_result[1]

        # Extract currency
        currency = extract_currency(ocr.text)

        # Calculate quality
        required_fields = [merchant, date, total]
        present_count = sum(1 for f in required_fields if f is not None)
        confidence = (present_count / len(required_fields)) * 100

        # Determine status
        status = "extracted" if confidence >= 80 else "needs_review"

        return ExtractResponse(
            merchant=merchant,
            date=date,
            total=total,
            tax=tax,
            currency=currency,
            confidence=round(confidence, 2),
            grounding=grounding,
            status=status
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Extraction failed: {str(e)}")


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": "Extract API",
        "version": "1.0.0",
        "endpoints": {
            "health": "GET /health",
            "extract": "POST /extract"
        }
    }
