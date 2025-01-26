# Stage 1: Build Static Frontend Files
FROM node:16-alpine AS build-static

WORKDIR /frontend
RUN mkdir -p certs

# Copy only package.json and package-lock.json for dependency installation
COPY frontend/smart-sec-cam/package.json frontend/smart-sec-cam/package-lock.json ./

# Install dependencies and cache the layer
RUN npm install

# Copy the rest of the frontend source code
COPY frontend/smart-sec-cam/ ./

# Build the frontend
RUN npm run build

# Stage 2: Build and Run Backend
FROM python:3.10-slim-buster AS run

LABEL maintainer="Scott Barnes <sgbarnes@protonmail.com>"

# Install sqlite3
RUN apt-get update && \
    apt-get install -y sqlite3 && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /backend/
RUN mkdir -p certs

# Copy the backend source code
COPY backend/ ./

# Copy the built static files from the previous stage
COPY --from=build-static /frontend/build/ /backend/build/

# Upgrade pip and install backend dependencies
RUN python -m pip install --no-cache-dir --upgrade pip
RUN python -m pip install --no-cache-dir .[server]

# Set the entrypoint script
ENTRYPOINT ["/backend/smart_sec_cam/server/docker-entrypoint.sh"]
