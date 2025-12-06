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
COPY automation-service/package*.json ./
COPY automation-service/tsconfig.json ./

# Installa TUTTE le dipendenze (serve TypeScript per compilare)
RUN npm install && npm cache clean --force

# Copia codice sorgente
COPY automation-service/src ./src

# Compila TypeScript
RUN npm run build

# Rimuovi devDependencies dopo build (opzionale, per ridurre dimensione immagine)
RUN npm prune --production

# Esponi porta
EXPOSE 3000

# Avvia servizio
CMD ["node", "dist/index.js"]

