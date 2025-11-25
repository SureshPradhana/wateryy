## Use Node.js LTS version
FROM node:20-alpine

# Install dependencies for canvas and build tools
RUN apk add --no-cache python3 py3-pip make g++ cairo-dev jpeg-dev pango-dev giflib-dev font-noto font-noto-cjk
# Create app directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy bot files
COPY . .


# Run the bot
CMD ["node", "bot.js"]

