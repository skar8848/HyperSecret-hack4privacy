FROM node:22-alpine3.21

RUN mkdir /app
WORKDIR /app

COPY package.json ./
RUN npm install --production

COPY src/ ./src/

ENTRYPOINT ["node", "/app/src/app.js"]
