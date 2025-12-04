FROM node:18-alpine

# Installa dipendenze per Puppeteer
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# Imposta variabili Puppeteer
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Crea directory di lavoro
WORKDIR /app

# Copia package files
COPY package*.json ./
COPY tsconfig.json ./

# Installa dipendenze
RUN npm ci --only=production && npm cache clean --force

# Copia codice sorgente
COPY src ./src

# Compila TypeScript
RUN npm run build

# Esponi porta
EXPOSE 3000

# Avvia servizio
CMD ["node", "dist/index.js"]

