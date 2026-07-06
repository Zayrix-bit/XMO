# Base image
FROM node:20-slim

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package*.json ./
RUN npm install

# Bundle app source
COPY . .

# Hugging Face Spaces requires the app to run on port 7860
EXPOSE 7860

# We use "npm start" as defined in our package.json to start the backend
CMD [ "npm", "start" ]
