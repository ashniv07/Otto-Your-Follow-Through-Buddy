# ---- Stage 1: build the frontend ----
FROM node:20-slim AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
# Empty string (not unset) so useOttoStore.tsx's `?? "http://localhost:8080"`
# fallback doesn't kick in — same-origin requests, since server.js serves
# this build itself. See backend/server.js's FRONTEND_DIST block.
ENV VITE_API_URL=""
RUN npm run build

# ---- Stage 2: backend + the built frontend ----
FROM node:20-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY backend/ ./backend/
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

ENV NODE_ENV=production
# Cloud Run sets PORT itself and expects the container to listen on it —
# backend/server.js already reads process.env.PORT with an 8080 fallback.
EXPOSE 8080
CMD ["node", "backend/server.js"]
