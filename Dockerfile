FROM ubuntu:latest

# Install necessary dependencies
RUN apt-get update && \
 apt-get install -y curl gnupg apt-transport-https && \
 rm -rf /var/lib/apt/lists/*

# Install Node.js 20
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
RUN apt-get install -y nodejs

# Install .NET SDK 8
RUN apt-get update && \
 apt-get install -y dotnet-sdk-8.0

# Install Java
RUN apt-get update && \
apt-get install -y openjdk-17-jdk

# Set JAVA_HOME environment variable
ENV JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
ENV PATH="$PATH:${JAVA_HOME}/bin"

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
