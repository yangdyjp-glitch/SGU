FROM node:24-alpine
WORKDIR /app
COPY --chown=node:node . .
RUN mkdir -p /app/.data && chown node:node /app/.data
USER node
ENV HOST=0.0.0.0 PORT=3210 DATA_DIR=/app/.data NODE_ENV=production
EXPOSE 3210
CMD ["node", "server.mjs"]
