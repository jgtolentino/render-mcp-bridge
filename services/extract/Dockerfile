FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Install Python dependencies
RUN pip install --no-cache-dir \
    fastapi==0.109.0 \
    uvicorn[standard]==0.27.0 \
    pydantic==2.5.3 \
    python-dateutil==2.8.2 \
    rapidfuzz==3.6.1

# Copy application code
COPY app.py /app/app.py

# Expose port
EXPOSE 8081

# Run the application
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8081"]
