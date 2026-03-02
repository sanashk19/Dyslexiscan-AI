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

2. Start the Frontend
Bash
cd frontend
npm install
npm run dev
