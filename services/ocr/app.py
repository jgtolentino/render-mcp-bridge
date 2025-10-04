"""
Instant OCR Service using PaddleOCR
Fast, CPU-optimized for receipt extraction
"""
import os
import io
import base64
from fastapi import FastAPI, UploadFile, Form, HTTPException, Depends, Header
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from paddleocr import PaddleOCR
from typing import List, Optional
from PIL import Image

# Configuration
OCR_LANG = os.getenv("OCR_LANG", "en")
BASIC_USER = os.getenv("BASIC_AUTH_USER")
BASIC_PASS = os.getenv("BASIC_AUTH_PASS")

# Initialize FastAPI
app = FastAPI(
    title="OCR Service",
    description="Instant receipt OCR using PaddleOCR",
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


@app.get("/health")
async def health():
    """Health check endpoint"""
    return {
        "ok": True,
        "service": "ocr",
        "lang": OCR_LANG,
        "auth_enabled": bool(BASIC_USER)
    }


@app.post("/ocr")
async def run_ocr(
    file: UploadFile,
    doc_id: str = Form(default=""),
    _auth: None = Depends(require_basic_auth)
):
    """
    Extract text from image using PaddleOCR

    Returns:
        {
            "doc_id": str,
            "text": str,  // Full extracted text
            "words": [
                {
                    "text": str,
                    "confidence": float,
                    "box": [[x0,y0], [x1,y1], [x2,y2], [x3,y3]]
                }
            ],
            "confidence": float  // Average confidence
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
            return JSONResponse({
                "doc_id": doc_id,
                "text": "",
                "words": [],
                "confidence": 0.0
            })

        # Parse results
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

            words.append({
                "text": text,
                "confidence": round(conf, 4),
                "box": box
            })

            all_text.append(text)
            total_conf += conf

        avg_confidence = round(total_conf / len(words) if words else 0.0, 4)
        full_text = " ".join(all_text)

        return JSONResponse({
            "doc_id": doc_id,
            "text": full_text,
            "words": words,
            "confidence": avg_confidence
        })

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OCR processing failed: {str(e)}")


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": "OCR API",
        "version": "1.0.0",
        "endpoints": {
            "health": "GET /health",
            "ocr": "POST /ocr"
        }
    }
