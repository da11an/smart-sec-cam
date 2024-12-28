FROM node:16-alpine

WORKDIR /frontend
RUN mkdir -p certs

COPY package.json package-lock.json ./
RUN npm install
RUN npm audit fix --force || true
COPY . .
RUN npm run build
RUN npm install -g serve

CMD ["serve", "-s", "build", "-l", "3000", "--ssl-cert", "./certs/sec-cam-server.cert", "--ssl-key", "./certs/sec-cam-server.key"]
