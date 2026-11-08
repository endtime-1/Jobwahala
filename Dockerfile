FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci --legacy-peer-deps

COPY . .

# Same-origin by default: nginx proxies /api to the backend (see docker/nginx.conf). Set this build
# argument only when the API lives on its own public domain.
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL
# Public keys baked into the site at build time. Both are optional: empty turns the feature off.
ARG VITE_SENTRY_DSN=
ARG VITE_TURNSTILE_SITE_KEY=
ARG VITE_RELEASE=
ARG VITE_GOOGLE_CLIENT_ID=
ARG VITE_WHATSAPP_CHANNEL_URL=
ARG VITE_LINKEDIN_URL=
ARG VITE_FACEBOOK_URL=
ARG VITE_INSTAGRAM_URL=
ARG VITE_TIKTOK_URL=
ARG VITE_X_URL=
ARG VITE_WHATSAPP_CHANNEL_JOBS=
ARG VITE_WHATSAPP_CHANNEL_INTERNSHIPS=
ARG VITE_WHATSAPP_CHANNEL_EMPLOYERS=
ENV VITE_SENTRY_DSN=$VITE_SENTRY_DSN
ENV VITE_TURNSTILE_SITE_KEY=$VITE_TURNSTILE_SITE_KEY
ENV VITE_RELEASE=$VITE_RELEASE
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
ENV VITE_WHATSAPP_CHANNEL_URL=$VITE_WHATSAPP_CHANNEL_URL
ENV VITE_LINKEDIN_URL=$VITE_LINKEDIN_URL
ENV VITE_FACEBOOK_URL=$VITE_FACEBOOK_URL
ENV VITE_INSTAGRAM_URL=$VITE_INSTAGRAM_URL
ENV VITE_TIKTOK_URL=$VITE_TIKTOK_URL
ENV VITE_X_URL=$VITE_X_URL
ENV VITE_WHATSAPP_CHANNEL_JOBS=$VITE_WHATSAPP_CHANNEL_JOBS
ENV VITE_WHATSAPP_CHANNEL_INTERNSHIPS=$VITE_WHATSAPP_CHANNEL_INTERNSHIPS
ENV VITE_WHATSAPP_CHANNEL_EMPLOYERS=$VITE_WHATSAPP_CHANNEL_EMPLOYERS

RUN npm run build

FROM nginx:1.27-alpine

ENV BACKEND_UPSTREAM=api:5000
# Makes the nginx entrypoint export NGINX_LOCAL_RESOLVERS (the container's own DNS server) for nginx.conf.
ENV NGINX_ENTRYPOINT_LOCAL_RESOLVERS=1

# Healthcheck to monitor web server health
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD ["wget", "-q", "-O", "/dev/null", "http://127.0.0.1/_web_health"] || exit 1

COPY docker/nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
# The app shell again, served with a 404 status for addresses that are not pages (see docker/nginx.conf).
RUN cp /usr/share/nginx/html/index.html /usr/share/nginx/html/404.html

EXPOSE 80
