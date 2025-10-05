FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# System libs for Paddle on CPU
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 libglib2.0-0 libgl1 ca-certificates curl \
  && rm -rf /var/lib/apt/lists/*

# CPU wheel for Paddle (do NOT install *-gpu)
RUN python -m pip install --upgrade pip
RUN python -m pip install "paddlepaddle==2.5.1" -i https://mirror.baidu.com/pypi/simple

COPY requirements.txt /app/requirements.txt
RUN python -m pip install -r /app/requirements.txt

COPY app.py /app/app.py

# Render provides $PORT; default to 10000 for local
ENV PORT=10000 OCR_LANG=en

EXPOSE 10000
CMD ["sh", "-c", "uvicorn app:app --host 0.0.0.0 --port ${PORT:-10000} --workers 1"]
