FROM caddy:alpine
COPY Caddyfile /etc/caddy/Caddyfile
COPY srv /srv
EXPOSE 80
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile"]
