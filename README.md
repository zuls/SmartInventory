# Inventory Management System with Phone Barcode Scannar 

A modern inventory management system built with React, TypeScript, and Firebase for warehouse operations.

![Screenshot 2025-06-28 at 12 45 52 PM](https://github.com/user-attachments/assets/99191005-440b-4afc-b891-43497b39dff1)

![Screenshot 2025-06-28 at 12 46 06 PM](https://github.com/user-attachments/assets/511e9510-8531-49de-979a-869bb8915bb5)


## 🚀 Features

- **Package Receiving**: Log incoming packages with tracking numbers
- **Real-time Dashboard**: View statistics and recent activity
- **Authentication**: Secure login with Firebase Auth
- **Search & Filter**: Find packages quickly
- **Label Management**: Assign and track package labels
- **Dispatch Tracking**: Mark packages as dispatched
- **Returns Processing**: Handle returned items
- **Stock Logging**: Daily inventory counts

## 🛠️ Tech Stack

- **Frontend**: React 18 + TypeScript
- **UI Framework**: Material-UI (MUI)
- **State Management**: Zustand
- **Backend**: Firebase (Firestore + Auth)
- **Form Handling**: React Hook Form
- **Build Tool**: Vite
- **Hosting**: Firebase Hosting

## 📦 Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/exonnex-inventory.git
cd exonnex-inventory

npm install

Set up environment variables:
Create a .env.local file and add your Firebase configuration:

VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef123456

Start the development server:


npm run dev


🔥 Firebase Setup

Create a Firebase project at https://console.firebase.google.com
Enable Authentication (Email/Password)
Create a Firestore database
Add your web app and copy the configuration
Update the .env.local file with your Firebase config

📱 Usage

Login: Create an account or sign in
Dashboard: View inventory statistics and quick actions
Receive Packages: Add new packages to inventory
Search: Find packages by tracking number, product name, or SKU
Manage Labels: Assign labels to packages for dispatch
Process Returns: Handle returned items

🏗️ Project Structure
src/
├── components/          # Reusable UI components
├── pages/              # Page components
├── hooks/              # Custom React hooks
├── services/           # Firebase and API services
├── stores/             # Zustand state stores
├── types/              # TypeScript type definitions
├── lib/                # Configuration files
└── utils/              # Helper functions
🚀 Deployment
Deploy to Firebase Hosting:
bashnpm run build
firebase deploy
📄 License
This project is private and proprietary.
