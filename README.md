# 🧠 DyslexiScan: Early Neurodevelopmental Screening Platform

DyslexiScan is a real-time, hardware-to-cloud diagnostic web platform designed to extract and analyze spatial markers from handwriting samples for early neurodevelopmental screening. 

## 🚀 Key Features
* **Real-Time IoT Telemetry:** Engineered a hardware-software pipeline connecting edge sensors (Arduino) to a Python/Flask REST API to stream live biomechanical data.
* **Clinical-Grade Dashboard:** A highly responsive web interface rendering zero-latency, synchronized data graphs for automated screening tests.
* **Deep Learning Engine:** Utilizes a lightweight multi-modal diagnostic engine (TensorFlow/OpenCV) to analyze complex spatial inputs with high confidence.

## 💻 Tech Stack
* **Frontend:** React.js, Vite, Tailwind CSS, Recharts
* **Backend:** Python, Flask, REST APIs
* **Machine Learning:** TensorFlow/Keras, OpenCV, CNNs
* **Hardware:** Arduino (Edge Sensors)

## ⚙️ Local Setup & Installation

### 1. Start the Backend
```bash
cd backend
python -m venv venv
Gemini said
Here is the exact, step-by-step playbook to set up your DyslexiScan repository from scratch so it looks like a professional engineer built it.

Step 1: Create the Clean Folder Structure
Since DyslexiScan has multiple moving parts (a React frontend, a Python backend, and hardware sensors), you should organize it into clearly named folders. Create a main folder on your computer named DyslexiScan and inside it, create this structure:

📁 frontend/ (Put all your React, Vite, and Tailwind code here)

📁 backend/ (Put your Python, Flask, TensorFlow, and OpenCV code here)

📁 hardware/ (Put your Arduino C++ scripts here, if applicable)

📄 README.md (We will write this in Step 4)

📄 .gitignore (Crucial step below)

Step 2: Create the .gitignore File
Before you type git add ., you must create a file named exactly .gitignore in the root of your main DyslexiScan folder. Open it in your code editor and paste this exactly:

Plaintext
# Node & React
frontend/node_modules/
frontend/dist/
frontend/.env

# Python & ML
backend/__pycache__/
backend/venv/
backend/env/
backend/.env
*.h5
*.pb

# OS specific
.DS_Store
(This ensures you do not upload massive dependency folders or trained model weights that clutter the repo).

Step 3: Push to GitHub
Now that your junk files are hidden, open your terminal, navigate to your DyslexiScan folder, and run:

git init

git add .

git commit -m "Initial commit: DyslexiScan architecture and source code"

Link it to your new GitHub repo and push (git remote add origin... then git push -u origin main).

Step 4: The Recruiter-Ready README.md
This is the most important part. When Arush at Creative Capsule or a recruiter at Megalon clicks your GitHub link, this is what they will read. Create a README.md file in the main folder and copy-paste this template:

Markdown
# 🧠 DyslexiScan: Early Neurodevelopmental Screening Platform

DyslexiScan is a real-time, hardware-to-cloud diagnostic web platform designed to extract and analyze spatial markers from handwriting samples for early neurodevelopmental screening. 

## 🚀 Key Features
* **Real-Time IoT Telemetry:** Engineered a hardware-software pipeline connecting edge sensors (Arduino) to a Python/Flask REST API to stream live biomechanical data.
* **Clinical-Grade Dashboard:** A highly responsive web interface rendering zero-latency, synchronized data graphs for automated screening tests.
* **Deep Learning Engine:** Utilizes a lightweight multi-modal diagnostic engine (TensorFlow/OpenCV) to analyze complex spatial inputs with high confidence.

## 💻 Tech Stack
* **Frontend:** React.js, Vite, Tailwind CSS, Recharts
* **Backend:** Python, Flask, REST APIs
* **Machine Learning:** TensorFlow/Keras, OpenCV, CNNs
* **Hardware:** Arduino (Edge Sensors)

## ⚙️ Local Setup & Installation

### 1. Start the Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows use `venv\Scripts\activate`
pip install -r requirements.txt
python app.py
### 2. Start the Frontend
cd frontend
npm install
npm run dev
