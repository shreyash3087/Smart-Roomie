# 🏡 Smart Roomie

**Smart Roomie** is a sensor-powered intelligent application designed to simplify the process of finding and offering living spaces. Whether you're a **Seeker** looking for a room to rent or a **Lister** with a space to offer, Smart Roomie helps you connect with the right roommate or tenant at the right time.

---

## 🚀 Features

- Seamless Seeker/Lister onboarding
- Firebase Authentication (Google Sign-In, Email/Password)
- Animated 3D model integration with [Spline](https://spline.design/)
- AI-powered interaction with Google Generative AI
- Roommate preference questionnaire
- Smooth UI/UX built with React and TailwindCSS

---

## 🛠️ Tech Stack

- **Frontend**: React (Next.js), TailwindCSS
- **3D & Animation**: Spline
- **Authentication**: Firebase Auth (Email & Google Sign-In)
- **AI Integration**: Google Generative AI
- **Icons**: Lucide React
- **State Management**: React Hooks

---

## 📦 Installation & Setup

1. **Clone the repository:**
```bash
git clone https://github.com/your-username/smart-roomie.git
cd smart-roomie
```
2. **Install dependencies:**
```bash
npm install
```
3. **Set up environment variables:**
Create a .env file in the root and add your Firebase and API credentials.
```
Add the Following - 
NEXT_PUBLIC_GEMINI_API_KEY
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
NEXT_PUBLIC_OPENCAGE_API_KEY
```
4. **Run the development server:**

```bash
npm run dev
```
### Open in browser:
Navigate to http://localhost:3000 to view the app.

## 📁 Folder Structure

│
├── app/                # Main pages & routes
│   ├── dashboard/      # Dashboard view
│   └── list/           # Listing view
│
├── components/         # Reusable UI components
├── context/            # Context API for global state
├── utils/              # Helper functions
├── firebase.js         # Firebase configuration
└── globals.css         # Global styles
📸 Preview

## 📬 Contact
For any queries or feedback, feel free to reach out:
📧 shreyash.23bce10931@vitbhopal.ac.in
