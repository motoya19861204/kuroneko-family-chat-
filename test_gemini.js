import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

const API_KEY = process.env.VITE_GEMINI_API_KEY;

async function test() {
  const promptHistory = [
    { role: 'model', parts: [{ text: "Hello" }] },
    { role: 'user', parts: [{ text: "Hi" }] }
  ];

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: promptHistory })
  });

  const data = await response.json();
  console.log(JSON.stringify(data, null, 2));
}

test();
