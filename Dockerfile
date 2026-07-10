# Use an official Python runtime as the base image  
FROM python:3.9-slim  
 
# Set the working directory inside the container  
WORKDIR /app  
 
# Copy the requirements file into the container  
COPY requirements.txt .  
 
# Install the app's dependencies  
RUN pip install --no-cache-dir -r requirements.txt  
 
# Copy the rest of the app's code into the container  
COPY . .  
 
# Expose the port the app runs on   
EXPOSE 80  
 
# Command to run the app when the container starts  
CMD ["python", "app.py"]  
