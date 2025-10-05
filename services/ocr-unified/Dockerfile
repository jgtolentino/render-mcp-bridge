FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# System libs Paddle needs
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 libglib2.0-0 libgl1 ca-certificates curl \
  && rm -rf /var/lib/apt/lists/*

# Use CPU wheel for Paddle; Baidu mirror hosts official wheels
RUN python -m pip install --upgrade pip
RUN python -m pip install "paddlepaddle==2.5.1" -i https://mirror.baidu.com/pypi/simple

COPY requirements.txt /app/requirements.txt
RUN python -m pip install -r /app/requirements.txt

COPY app.py /app/app.py

ENV PORT=10000 OCR_LANG=en
EXPOSE 10000
CMD ["python", "-m", "uvicorn", "app:app", "--host", "0.0.0.0", "--port", "10000", "--workers", "1"]
