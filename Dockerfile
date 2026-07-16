# Multi-stage: build the Vite app with Node, then serve the static bundle with nginx.
# Base images match BuilderBot's node convention; the runtime stage is a tiny nginx.

FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci || npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
