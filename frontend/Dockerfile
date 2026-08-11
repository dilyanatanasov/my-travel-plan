# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# The app talks to a relative /api, which nginx proxies to the backend, so no
# API host is baked into the bundle. Overridable for a split-origin deploy.
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# Production stage
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html

# All configs ship; the entrypoint picks one based on which certificates
# exist for $DOMAIN / $ALT_DOMAIN.
COPY nginx.conf.template      /etc/nginx/available/nginx.conf.template
COPY nginx.http.conf.template /etc/nginx/available/nginx.http.conf.template
COPY nginx.alt.conf.template  /etc/nginx/available/nginx.alt.conf.template
COPY security-headers.conf    /etc/nginx/snippets/security-headers.conf
COPY docker-entrypoint.d/10-select-nginx-template.sh /docker-entrypoint.d/10-select-nginx-template.sh
RUN chmod +x /docker-entrypoint.d/10-select-nginx-template.sh

# Substitute only DOMAIN-ish variables. Left unfiltered, envsubst would also
# eat nginx's own $uri, $host and $request_uri and produce a broken config.
# The filter is an unanchored regex, so ALT_DOMAIN matches it too.
ENV NGINX_ENVSUBST_FILTER=DOMAIN
ENV DOMAIN=localhost
ENV ALT_DOMAIN=""

EXPOSE 80 443

CMD ["nginx", "-g", "daemon off;"]
