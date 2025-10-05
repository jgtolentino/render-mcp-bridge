"""
Unified OCR + Extraction Service
Combines PaddleOCR and rules-based extraction in single microservice
"""
import os
import io
import re
import base64
from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, UploadFile, Form, HTTPException, Depends, Header
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from paddleocr import PaddleOCR
from pydantic import BaseModel
from dateutil import parser as date_parser
from PIL import Image

# Configuration
OCR_LANG = os.getenv("OCR_LANG", "en")
BASIC_USER = os.getenv("BASIC_AUTH_USER")
BASIC_PASS = os.getenv("BASIC_AUTH_PASS")

# Initialize FastAPI
app = FastAPI(
    title="OCR Unified Service",
    description="Instant receipt OCR + field extraction",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize PaddleOCR (lazy load on first request)
_ocr = None

def get_ocr():
    global _ocr
    if _ocr is None:
        _ocr = PaddleOCR(
            use_angle_cls=True,
            lang=OCR_LANG,
            use_gpu=False,
            show_log=False
        )
    return _ocr


def require_basic_auth(authorization: Optional[str] = Header(None)):
    """Optional Basic Auth if credentials are set"""
    if not BASIC_USER or not BASIC_PASS:
        return  # Auth not configured, skip

    if not authorization or not authorization.startswith("Basic "):
        raise HTTPException(status_code=401, detail="Unauthorized", headers={"WWW-Authenticate": "Basic"})

    try:
        encoded = authorization.split(" ", 1)[1]
        decoded = base64.b64decode(encoded).decode("utf-8")
        username, password = decoded.split(":", 1)

        if username != BASIC_USER or password != BASIC_PASS:
            raise HTTPException(status_code=401, detail="Invalid credentials")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid authorization header")


# Models
class Word(BaseModel):
    text: str
    confidence: float
    box: List[List[float]]


class ExtractResponse(BaseModel):
    merchant: Optional[str]
    date: Optional[str]  # ISO format
    total: Optional[float]
    tax: Optional[float]
    currency: str
    confidence: float
    grounding: Dict[str, List[List[float]]]  # Field -> box mapping
    status: str  # 'extracted', 'needs_review'
    ocr_text: str
    ocr_confidence: float


# Extraction Functions
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
        "service": "ocr-unified",
        "lang": OCR_LANG,
        "auth_enabled": bool(BASIC_USER)
    }


@app.post("/process", response_model=ExtractResponse)
async def process_receipt(
    file: UploadFile,
    doc_id: str = Form(default=""),
    _auth: None = Depends(require_basic_auth)
):
    """
    Complete receipt processing: OCR + field extraction

    Returns:
        {
            "merchant": str,
            "date": str (ISO format),
            "total": float,
            "tax": float,
            "currency": str,
            "confidence": float,
            "grounding": {"field": [[x,y]...]},
            "status": "extracted" | "needs_review",
            "ocr_text": str (full extracted text),
            "ocr_confidence": float
        }
    """
    try:
        # Read uploaded file
        content = await file.read()

        # Validate it's an image
        try:
            img = Image.open(io.BytesIO(content))
            img.verify()
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid image file: {str(e)}")

        # Run OCR
        ocr = get_ocr()
        result = ocr.ocr(content, cls=True)

        if not result or not result[0]:
            return ExtractResponse(
                merchant=None,
                date=None,
                total=None,
                tax=None,
                currency="USD",
                confidence=0.0,
                grounding={},
                status="needs_review",
                ocr_text="",
                ocr_confidence=0.0
            )

        # Parse OCR results
        words = []
        all_text = []
        total_conf = 0.0

        for line in result[0]:
            # line[0] = box coordinates, line[1] = (text, confidence)
            box_coords = line[0]
            text, conf = line[1][0], float(line[1][1])

            # Convert box to simplified format
            box = [
                [float(box_coords[0][0]), float(box_coords[0][1])],
                [float(box_coords[1][0]), float(box_coords[1][1])],
                [float(box_coords[2][0]), float(box_coords[2][1])],
                [float(box_coords[3][0]), float(box_coords[3][1])]
            ]

            words.append(Word(
                text=text,
                confidence=round(conf, 4),
                box=box
            ))

            all_text.append(text)
            total_conf += conf

        ocr_confidence = round(total_conf / len(words) if words else 0.0, 4)
        full_text = " ".join(all_text)

        # Extract fields
        grounding = {}

        # Merchant
        merchant_result = extract_merchant(words)
        merchant = merchant_result[0] if merchant_result else None
        if merchant_result and merchant_result[1]:
            grounding["merchant"] = merchant_result[1]

        # Date
        date_result = extract_date(full_text, words)
        date = date_result[0] if date_result else None
        if date_result and date_result[1]:
            grounding["date"] = date_result[1]

        # Total
        total_result = extract_money(full_text, words, hint="total")
        total = total_result[0] if total_result else None
        if total_result and total_result[1]:
            grounding["total"] = total_result[1]

        # Tax
        tax_result = extract_money(full_text, words, hint="tax")
        tax = tax_result[0] if tax_result else None
        if tax_result and tax_result[1]:
            grounding["tax"] = tax_result[1]

        # Currency
        currency = extract_currency(full_text)

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
            status=status,
            ocr_text=full_text,
            ocr_confidence=ocr_confidence
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Receipt processing failed: {str(e)}")


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": "OCR Unified API",
        "version": "1.0.0",
        "endpoints": {
            "health": "GET /health",
            "process": "POST /process (OCR + extraction in one call)"
        }
    }
