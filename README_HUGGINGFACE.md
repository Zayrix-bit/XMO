# Deployment Guide - Backend on Hugging Face, Frontend on Vercel

## Overview
This guide will help you deploy the backend API to Hugging Face Spaces and the frontend to Vercel.

---

## Part 1: Deploy Backend to Hugging Face Spaces

### Step 1: Prepare Backend Files
The backend is already configured for Hugging Face:
- Uses port 7860 (Hugging Face default)
- No frontend static file serving (frontend is separate)

### Step 2: Create a Hugging Face Space
1. Go to https://huggingface.co/spaces
2. Click "Create new Space"
3. Choose a name for your Space (e.g., "hotster-api")
4. Select "Docker" as the SDK
5. Choose a license
6. Click "Create Space"

### Step 3: Upload Files
Upload your entire project to the Space, or use Git:

```bash
git init
git add .
git commit -m "Initial backend commit"
git remote add origin https://huggingface.co/spaces/YOUR_USERNAME/YOUR_SPACE_NAME
git push -u origin main
```

### Step 4: Create a Dockerfile (if needed)
Create a `Dockerfile` in the project root:

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Copy requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the entire project
COPY . .

# Expose port
EXPOSE 7860

# Run the app
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7860"]
```

### Step 5: Get Your Backend URL
After deployment, your backend will be available at:
`https://YOUR_USERNAME-YOUR_SPACE_NAME.hf.space`

---

## Part 2: Deploy Frontend to Vercel

### Step 1: Prepare Frontend
The frontend is already set up to use `VITE_API_BASE_URL` environment variable.

### Step 2: Deploy to Vercel
1. Go to https://vercel.com and sign up/login
2. Click "New Project"
3. Import your GitHub/GitLab repository (or upload the frontend folder)
4. In the "Environment Variables" section, add:
   - Name: `VITE_API_BASE_URL`
   - Value: Your Hugging Face backend URL (e.g., `https://YOUR_USERNAME-YOUR_SPACE_NAME.hf.space`)
5. Click "Deploy"

### Step 3: Done!
Your frontend will be available at a Vercel URL (e.g., `https://your-project-name.vercel.app`)

---

## Important Notes
- Make sure your Hugging Face Space is public or properly configured
- The backend CORS is set to allow all origins (`*`) so Vercel can access it
- The backend uses diskcache for caching, which works on Hugging Face Spaces
