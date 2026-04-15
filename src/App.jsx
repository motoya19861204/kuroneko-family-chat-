import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import { db } from './firebase';
import { ref, onValue, set, query, limitToLast } from 'firebase/database';

const FIREBASE_CONFIGURED = !!import.meta.env.VITE_FIREBASE_API_KEY;

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";

const SYSTEM_INSTRUCTION = `
あなたは「はっぱ姉妹の日常」に登場する、黒猫の姿をした「神様」です。
以下の性格、口調、制約を厳守してください。

【キャラクター設定】
- 性格: 尊大で自信満々。本物の神様だと自認している。口調こそ偉そうだが、人間の質問や悩みには真摯に（真面目に、ていねいに）答えてあげるツンデレな一面がある。
- 一人称: 「我（われ）」「わらわ」を使い分ける。
- 二人称: 「貴様（きさま）」「おぬし」。

【制約条件（最優先）】
- 言葉のレベル: 【最重要】小学3年生以下の子供が読んですぐに理解できる、やさしくて簡単な言葉だけを使うこと。難しい言葉や説明は絶対に使わず、子供向けの例え話を使うこと。
- 漢字制限: 使用する漢字は「小学3年生までに習う漢字」のみに限定すること。それ以外の少しでも難しい漢字は、すべて「ひらがな」にすること。

- 子供が読みやすいよう、1回の返答は1〜3文程度に短くまとめること。
- 語尾に「〜じゃ」「〜のう」「〜であるぞ」などを混ぜる。
- 時おり猫らしいしぐさ（「…ニャ。」「フンッ」など）を入れる。
- 回答に「」などのカッコは絶対に使わないこと。
`;

function App() {
  const [userName, setUserName] = useState(localStorage.getItem('userName') || '');
  const [isJoined, setIsJoined] = useState(false); // ★ 常に最初は名前確認画面を出すように変更
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);

  // 初回ロード時とFirebaseからの同期
  useEffect(() => {
    if (!FIREBASE_CONFIGURED) return;

    const chatRef = ref(db, 'chatMessages');
    const q = query(chatRef, limitToLast(100)); // ★ 読み込みを100件に制限（動作軽量化）
    const unsubscribe = onValue(q, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        // キー付きオブジェクトから配列に変換（limitToLastを使うと構造が変わる可能性があるため）
        const messageArray = Object.values(data);
        setMessages(messageArray);

        // バッジ（通知）の更新：画面を見ていない時に新着があれば
        if (!document.hasFocus() && 'setAppBadge' in navigator) {
          navigator.setAppBadge();
        }
      } else {
        // 空の場合はウェルカムメッセージをセット
        const welcome = {
          id: Date.now(),
          author: '黒猫',
          text: 'ふん……来たか、人間どもよ。\n我は神じゃ。ただの黒猫だと思うなよ。\n我に話しかけたい時はメッセージに「ねこ」と呼ぶがよい！',
          isCat: true
        };
        set(ref(db, 'chatMessages'), [welcome]);
      }
    });

    return () => unsubscribe();
  }, []);

  // 音声入力の初期化
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.lang = 'ja-JP';
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onresult = (event) => {
        const text = event.results[0][0].transcript;
        if (text) {
          setInputValue(prev => prev + text);
        }
        // 文字が入ったらすぐに停止を試みる
        setIsRecording(false);
        recognition.stop();
      };

      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  const toggleRecording = () => {
    if (!recognitionRef.current) return;

    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsRecording(true);
      } catch (err) {
        // すでに動いている可能性がある場合は一旦止めてから出し直す
        recognitionRef.current.abort();
        setTimeout(() => {
          try {
            recognitionRef.current.start();
            setIsRecording(true);
          } catch (e) {
            console.error("Failed to restart speech recognition:", e);
            setIsRecording(false);
          }
        }, 100);
      }
    }
  };

  // 画面に戻った時にバッジを消す
  useEffect(() => {
    const handleFocus = () => {
      if ('clearAppBadge' in navigator) {
        navigator.clearAppBadge();
      }
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  // メッセージが追加された時、またはチャットルームに入った時に一番下へスクロール
  useEffect(() => {
    if (isJoined) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isJoined]);

  const handleJoin = (e) => {
    e.preventDefault();
    const name = e.target.elements.name.value.trim();
    if (name) {
      localStorage.setItem('userName', name);
      setUserName(name);
      setIsJoined(true);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    const newMsg = {
      id: Date.now(),
      author: userName,
      text: inputValue.trim(),
      isCat: false
    };

    let newHistory = [...messages, newMsg];
    if (newHistory.length > 1000) {
      newHistory = newHistory.slice(-1000); // ★ 保存を1000件に制限（容量整理）
    }

    if (FIREBASE_CONFIGURED) {
      set(ref(db, 'chatMessages'), newHistory);
    } else {
      setMessages(newHistory); // ローカルフォールバック
    }
    setInputValue('');

    // AI呼び出しトリガー：「ねこ」「ネコ」「猫」「クロ」が含まれている場合
    const triggerWords = ['ねこ', 'ネコ', '猫', 'クロ', '神様'];
    const shouldCatReply = triggerWords.some(word => newMsg.text.includes(word));

    try {
      if (shouldCatReply) {
        setIsTyping(true);
        await askGemini(newHistory);
      }
    } finally {
      setIsTyping(false);
    }
  };

  const askGemini = async (currentHistory, retryCount = 0) => {
    if (!GEMINI_API_KEY) {
      addCatMessage("APIキーが設定されておらぬぞ！.envファイルを確認せい！");
      return;
    }

    // 最新20件の履歴をGeminiの形式に変換
    const promptHistory = currentHistory.slice(-20).map(m => {
      return {
        role: m.isCat ? "model" : "user",
        // 黒猫自身の過去の発言にはカッコを付けず、人間の発言にだけ名前を付けて送る（AIの真似を防ぐため）
        parts: [{ text: m.isCat ? m.text : `${m.author}「${m.text}」` }]
      };
    });

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: promptHistory,
          systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] }
        })
      });

      const data = await response.json();
      if (data.candidates && data.candidates[0]) {
        const replyText = data.candidates[0].content.parts[0].text;
        addCatMessage(replyText, currentHistory);
      } else if (data.error && data.error.code === 429) {
        if (retryCount < 3) {
          // 制限に引っかかった場合は5秒待って再リトライ
          await new Promise(resolve => setTimeout(resolve, 5000));
          await askGemini(currentHistory, retryCount + 1);
        } else {
          addCatMessage("我は今とても忙しいのじゃ……また後で呼ぶがよい！", currentHistory);
        }
      } else if (data.error) {
        addCatMessage(`通信エラーじゃ！（${data.error.message}）`, currentHistory);
      } else {
        addCatMessage("むむ……我も少し疲れたわい。（予期せぬエラー）", currentHistory);
      }
    } catch (error) {
      if (retryCount < 3) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        await askGemini(currentHistory, retryCount + 1);
      } else {
        addCatMessage(`通信エラーじゃ！ ${error.message}`, currentHistory);
      }
    }
  };

  const addCatMessage = (text, history) => {
    const catMsg = {
      id: Date.now(),
      author: '黒猫',
      text: text,
      isCat: true
    };
    let newHistory = [...history, catMsg];
    if (newHistory.length > 1000) {
      newHistory = newHistory.slice(-1000); // ★ 猫の返信時もお掃除
    }

    if (FIREBASE_CONFIGURED) {
      set(ref(db, 'chatMessages'), newHistory);
    } else {
      setMessages(prev => [...prev, catMsg]);
    }
  };

  if (!FIREBASE_CONFIGURED) {
    return (
      <div className="login-screen" style={{ textAlign: 'center', padding: '20px' }}>
        <h2>⚠️ データベースの接続が必要です</h2>
        <p>本番の家族チャット（端末間通信）を利用するには、Firebaseの設定が必要です。</p>
        <p>VSCode内の <b>.env</b> ファイルを開き、Firebaseの接続情報を入力してください。</p>
      </div>
    );
  }

  if (!isJoined) {
    return (
      <div className="login-screen">
        <img src="/Neko-up.jpg" alt="黒猫" style={{ width: 100, borderRadius: '50%', marginBottom: 20 }} />
        <h1>あなたのおなまえは？</h1>
        <form onSubmit={handleJoin} style={{ width: '100%', textAlign: 'center' }}>
          <input 
            name="name" 
            type="text" 
            defaultValue={userName} 
            placeholder="パパ、ママ、〇〇ちゃん" 
            required 
            autoComplete='off' 
          />
          <br />
          <button type="submit">チャットルームに入る</button>
        </form>
      </div>
    );
  }

  return (
    <div className="chat-container">
      <div className="chat-messages">
        {messages.map((msg) => {
          const isMe = msg.author === userName;
          const isCat = msg.isCat;

          return (
            <div key={msg.id} className={`message-row ${isMe ? 'me' : 'other'} ${isCat ? 'cat' : ''}`}>
              {!isMe && (
                <div className="avatar-container">
                  <div className="avatar">
                    {isCat ? <img src="/Neko-default.jpg" alt="猫" /> : msg.author.charAt(0)}
                  </div>
                  <div className="sender-name">{msg.author}</div>
                </div>
              )}
              <div className="bubble">
                {msg.text.split('\n').map((line, i) => <React.Fragment key={i}>{line}<br /></React.Fragment>)}
              </div>
            </div>
          );
        })}
        {isTyping && (
          <div className="message-row other cat">
            <div className="avatar-container">
              <div className="avatar"><img src="/Neko-up.jpg" alt="猫" /></div>
            </div>
            <div className="bubble" style={{ color: '#888' }}>フンッ…考え中じゃ…</div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form className="input-area" onSubmit={handleSendMessage}>
        {recognitionRef.current && (
          <button 
            type="button" 
            className={`mic-btn ${isRecording ? 'recording' : ''}`} 
            onClick={toggleRecording}
          >
            🎤
          </button>
        )}
        <input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="メッセージを入力…"
        />
        <button type="submit" className="send-btn" disabled={!inputValue.trim()}>↑</button>
      </form>
      <style>{`
        .send-btn:disabled {
          background-color: #ccc;
        }

        .mic-btn {
          background-color: #f0f0f0;
          color: #333;
          border: none;
          width: 44px;
          height: 44px;
          border-radius: 50%;
          margin-right: 8px;
          font-size: 1.2rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }

        .mic-btn.recording {
          background-color: #ff4b4b;
          color: white;
          animation: pulse 1.5s infinite;
        }

        @keyframes pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.1); }
          100% { transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

export default App;
