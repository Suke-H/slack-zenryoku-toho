FROM node:20-slim AS builder
WORKDIR /app
COPY package.json tsconfig.json ./
RUN npm install
COPY src ./src
RUN npm run build

FROM node:20-slim
WORKDIR /app
COPY package.json ./
RUN npm install --production
COPY --from=builder /app/dist ./dist
ENV PORT=8080
EXPOSE 8080
CMD ["node", "dist/index.js"]
