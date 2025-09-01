FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci --omit=dev

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Install http-server globally for serving static files
RUN npm install -g http-server

EXPOSE 3000

# Serve the built files
CMD ["http-server", "dist", "-p", "3000", "-a", "0.0.0.0"]
