FROM node:20

# Create app directory
WORKDIR /usr/src/app

# Set port to 7860 for Hugging Face Spaces
ENV PORT=7860

# Install app dependencies
COPY package*.json ./
RUN npm install


# Bundle app source
COPY . .

# Hugging Face Spaces requires the app to run on port 7860
EXPOSE 7860

# We use "npm start" as defined in our package.json to start the backend
CMD [ "npm", "start" ]
