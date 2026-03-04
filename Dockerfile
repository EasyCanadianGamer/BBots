FROM node:20-slim

WORKDIR /app

# Install build tools for better-sqlite3 + ffmpeg for music playback
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ ffmpeg \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# data/ is mounted as a volume — don't bake it into the image
VOLUME ["/app/data"]

CMD ["node", "src/index.js"]
