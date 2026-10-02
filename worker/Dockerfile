FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install all dependencies (worker + backend shared)
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source so we can import models/core
COPY ./backend/app /app/backend_app

# Copy worker source
COPY ./worker /app

# Add backend_app to Python path so worker can do "from models import ..."
ENV PYTHONPATH="/app:/app/backend_app"

CMD ["python", "main.py"]
