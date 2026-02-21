# Emotion-Aware Adaptive Tutor

An intelligent tutoring system that adapts learning difficulty based on real-time emotion recognition (facial expressions and voice) and student performance.

### Prerequisites

- **Python 3.8+** (for backend)
- **Node.js 18+** (for frontend)
- **npm** (comes with Node.js)

### Running the Application

The application consists of two parts: **Backend** (FastAPI) and **Frontend** (Next.js). Both need to be running simultaneously.

---

## SER Model Setup

-- Run FER_SER Model Training/SER model.ipynb file 
-- The ser_clf.pkl model will be generated inside a backend/models folder
-- Place it in emotion aware tutor/backend/models

## Backend Setup

### Step 1: Navigate to Backend Directory
```bash
cd backend
```

### Step 2: Create Virtual Environment (Optional but Recommended)
```bash
# Using venv
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate
```

### Step 3: Install Dependencies
```bash
pip install -r requirements.txt
```

### Step 4: Start Backend Server
```bash
uvicorn app_backend.main:app --reload --host 127.0.0.1 --port 8000
```

**Backend is running on http://127.0.0.1:8000**

**Keep this terminal window open** - the backend server must stay running.

---

## Frontend Setup

### Step 1: Open a NEW Terminal Window
(Keep the backend terminal running)

### Step 2: Navigate to Frontend Directory
```bash
cd frontend
```

### Step 3: Install Dependencies (First Time Only)
```bash
npm install
```

This may take a few minutes to install all packages.

### Step 4: Start Frontend Development Server
```bash
npm run dev
```
**Frontend is running on http://localhost:3000**

---

## Access the Application

1. Open your web browser
2. Navigate to: **http://localhost:3000**
3. The application should load and connect to the backend API

---

## Verification

### Check Backend is Running:
- Visit: http://127.0.0.1:8000/health
- Should return: `{"status": "ok"}`

### Check Frontend is Running:
- Visit: http://localhost:3000
- Should see the Emotion-Aware Tutor interface

### API Documentation:
- Visit: http://127.0.0.1:8000/docs
- Interactive Swagger UI with all API endpoints

---

## Quick Start Commands (After Initial Setup)

### Terminal 1 - Backend:
```bash
cd backend
# Activate virtual environment if using one
uvicorn app_backend.main:app --reload --host 127.0.0.1 --port 8000
```

### Terminal 2 - Frontend:
```bash
cd frontend
npm run dev
```



