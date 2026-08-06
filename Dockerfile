# Multi-stage build: Node build produces a static dist/, nginx serves it.

FROM node:22-alpine AS build
WORKDIR /build

# Dependency layer cached separately from source.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:1.27-alpine AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /build/dist /usr/share/nginx/html

EXPOSE 80
