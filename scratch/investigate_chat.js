
import { initializeApp } from "firebase/app";
import { getDatabase, ref, get, query, limitToLast } from "firebase/database";
import dotenv from 'dotenv';
dotenv.config();

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.VITE_FIREBASE_DATABASE_URL,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

async function investigate() {
    console.log("=== LATEST CHAT MESSAGES ANALYZER ===");
    const chatRef = ref(db, 'chatMessages');
    const q = query(chatRef, limitToLast(10));
    const snapshot = await get(q);
    
    if (snapshot.exists()) {
        const messages = Object.values(snapshot.val()).sort((a,b) => a.id - b.id);
        messages.forEach(msg => {
            console.log(`\n[${msg.id}] ${msg.author}: "${msg.text}"`);
            console.log(`Icon: ${msg.userIcon}`);
            if (msg.rawText) console.log(`Raw: "${msg.rawText.replace(/\n/g, '\\n')}"`);
        });
    } else {
        console.log("No messages found.");
    }
    process.exit();
}

investigate();
