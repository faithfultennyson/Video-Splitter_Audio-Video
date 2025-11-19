FROM node:22-bullseye-slim

# Create app directory
WORKDIR /usr/src/app

# Install ffmpeg (system package) and clean apt lists to reduce image size
RUN apt-get update \
  && apt-get install -y ffmpeg \
  && rm -rf /var/lib/apt/lists/*

# Copy package manifests and install dependencies
COPY package*.json ./

# Use production install for runtime image
RUN npm install --production

# Copy app source
COPY . .

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["npm", "start"]
