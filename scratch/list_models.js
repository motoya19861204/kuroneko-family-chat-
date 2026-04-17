import dotenv from 'dotenv';
dotenv.config();

const API_KEY = process.env.VITE_GEMINI_API_KEY;

async function listModels() {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`);
  const data = await response.json();
  console.log(JSON.stringify(data, null, 2));
}

listModels();
