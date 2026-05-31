FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
COPY apps/api/package.json apps/api/package.json
COPY packages/scoring/package.json packages/scoring/package.json
RUN npm install

COPY packages/scoring packages/scoring
COPY apps/api apps/api
RUN npm --workspace @prguard/scoring run build
RUN npm --workspace @prguard/api run build

EXPOSE 4100
CMD ["npm", "--workspace", "@prguard/api", "run", "start"]
