FROM node:20

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package*.json ./
RUN npm install

# Install Playwright and its OS dependencies
RUN npx playwright install --with-deps chromium

# Bundle app source
COPY . .

# Hugging Face Spaces requires the app to run on port 7860
EXPOSE 7860

# We use "npm start" as defined in our package.json to start the backend
CMD [ "npm", "start" ]
