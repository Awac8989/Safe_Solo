# ==============================================================================
# SafeSolo Backend Dockerfile (Production-Ready)
# Node.js 20 Alpine - Nhe, Bao mat, Toi uu cache layer
# ==============================================================================

FROM node:20-alpine AS builder

WORKDIR /app

# Cai dat dependencies san xuat
COPY package*.json ./
RUN npm ci --omit=dev

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

# Tao thu muc uploads luu tru bang chung khan cap, hinh anh KYC
RUN mkdir -p /app/uploads && chown -R node:node /app

# Copy node_modules tu stage builder
COPY --from=builder /app/node_modules ./node_modules
COPY . .

# Su dung user node phi dac quyen tranh chay bang root
USER node

EXPOSE 4000

# Healthcheck xac thuc backend dang hoat dong
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:4000/health || exit 1

CMD ["node", "server.js"]
