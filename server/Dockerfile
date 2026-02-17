# SentinelPharma Server Dockerfile
# Node.js + Express

FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Create logs directory
RUN mkdir -p logs

# Expose port
EXPOSE 3001

# Start server
CMD ["npm", "run", "dev"]
