FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
COPY apps/web/package.json apps/web/package.json
RUN npm install

COPY tailwind.config.js tailwind.config.js
COPY apps/web apps/web
RUN npm --workspace @prguard/web run build

EXPOSE 5173
CMD ["npm", "--workspace", "@prguard/web", "run", "preview", "--", "--host", "0.0.0.0"]
