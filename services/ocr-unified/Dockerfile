FROM python:3.10-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# System libs needed by Paddle/PaddleOCR
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 libglib2.0-0 libgl1 ca-certificates curl \
  && rm -rf /var/lib/apt/lists/*

RUN python -m pip install --upgrade pip

# Install Paddle *CPU* wheel from official find-links (stable)
RUN python -m pip install --no-cache-dir \
    "paddlepaddle==2.6.1" \
    -f https://www.paddlepaddle.org.cn/whl/linux/cpu-mkl/avx/stable.html

# App deps
COPY requirements.txt /app/requirements.txt
RUN python -m pip install --no-cache-dir -r /app/requirements.txt

# App code
COPY app.py /app/app.py

# Respect Render's PORT
ENV PORT=10000 OCR_LANG=en
EXPOSE 10000
CMD ["sh", "-c", "uvicorn app:app --host 0.0.0.0 --port ${PORT:-10000} --workers 1"]
