
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
    console.log("Investigating chat messages...");
    const chatRef = ref(db, 'chatMessages');
    const q = query(chatRef, limitToLast(50));
    const snapshot = await get(q);
    
    if (snapshot.exists()) {
        const messages = snapshot.val();
        Object.values(messages).forEach(msg => {
            if (msg.author === '黒猫') {
                console.log(`--- [Cat Message] ---`);
                console.log(`Text: ${msg.text}`);
                console.log(`Icon: ${msg.userIcon}`);
                
                // タグが残っているかチェック
                const hasTag = msg.text.match(/[\[［]mood[:：].*?[\］］]/i);
                if (hasTag) {
                    console.log(`>>> DETECTED UNMATCHED TAG: ${hasTag[0]}`);
                } else {
                    console.log(`(No tags found in text)`);
                }
            }
        });
    } else {
        console.log("No messages found.");
    }
    process.exit();
}

investigate();
