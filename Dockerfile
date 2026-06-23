FROM python:3.11-slim

WORKDIR /app

# Copy requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy ONLY the single root main.py (complete working file)
COPY main.py .

# Expose port
EXPOSE 7860

# Run the app from the single root main.py file
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]
