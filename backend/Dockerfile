FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    gcc \
    sqlite3 \
    libsqlite3-dev \
    && rm -rf /var/lib/apt/lists/*

# Fix for ChromaDB/pysqlite3 compatibility
ENV LD_LIBRARY_PATH=/usr/local/lib
RUN ln -sf /usr/lib/x86_64-linux-gnu/libsqlite3.so.0 /usr/lib/x86_64-linux-gnu/libsqlite3.so

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Set up SQLite directory and permissions
RUN mkdir -p /app/db /app/.crewai/memory && chmod -R 777 /app/db /app/.crewai/memory
