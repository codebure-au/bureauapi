FROM node:alpine

WORKDIR /usr/src/app

COPY package.json yarn.lock ./

RUN yarn --frozen-lockfile

COPY . .

RUN yarn build

EXPOSE 3000

ENV ENVIRONMENT docker

CMD ["npm", "./build/index.js"]