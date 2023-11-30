FROM node:latest

USER node

RUN mkdir /home/node/code

WORKDIR /home/node/code

COPY --chown=node:node package*.json ./

RUN npm install

COPY --chown=node:node . .

CMD ["node", "index.js"]