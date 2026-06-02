FROM ubuntu:latest

# Install necessary dependencies
RUN apt-get update && \
 apt-get install -y curl gnupg apt-transport-https && \
 rm -rf /var/lib/apt/lists/*

# Install Node.js 20
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
RUN apt-get install -y nodejs

# Set working directory
WORKDIR /app

# Install
COPY package*.json ./

# Install Node.js dependencies
RUN npm install

# Copy application
COPY . .

# Define default command
CMD ["npm", "start"]
