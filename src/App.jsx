import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import { db } from './firebase';
import { ref, onValue, set, query, limitToLast } from 'firebase/database';

const FIREBASE_CONFIGURED = !!import.meta.env.VITE_FIREBASE_API_KEY;

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";
const ONESIGNAL_APP_ID = import.meta.env.VITE_ONESIGNAL_APP_ID || "";
const ONESIGNAL_REST_KEY = import.meta.env.VITE_ONESIGNAL_REST_API_KEY || "";

const USER_ICONS = [
  { id: 'papa', name: 'パパ', src: '/icons/papa.png' },
  { id: 'mama', name: 'ママ', src: '/icons/mama.png' },
  { id: 'onechan', name: 'おねえちゃん', src: '/icons/onechan.png' },
  { id: 'imouto', name: 'いもうと', src: '/icons/imouto.png' },
];

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
  const [userIcon, setUserIcon] = useState(localStorage.getItem('userIcon') || 'papa');
  const [isJoined, setIsJoined] = useState(false); // ★ 常に最初は名前確認画面を出すように変更
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);

  // OneSignal初期化
  useEffect(() => {
    if (ONESIGNAL_APP_ID) {
      window.OneSignalDeferred = window.OneSignalDeferred || [];
      window.OneSignalDeferred.push(async function(OneSignal) {
        await OneSignal.init({
          appId: ONESIGNAL_APP_ID,
          safari_web_id: "web.onesignal.auto.10425890-580a-4221-a477-7427189154f3",
          notifyButton: {
            enable: true,
          },
        });
      });
    }
  }, []);

  // 通知を送信する関数 (OneSignal REST API)
  const sendPushNotification = async (author, text) => {
    if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_KEY) return;

    try {
      await fetch("https://onesignal.com/api/v1/notifications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Authorization": `Basic ${ONESIGNAL_REST_KEY}`
        },
        body: JSON.stringify({
          app_id: ONESIGNAL_APP_ID,
          included_segments: ["All"], // 全員に送る
          headings: { "en": "黒猫ファミリーチャット", "ja": "黒猫ファミリーチャット" },
          contents: { "en": `${author}: ${text}`, "ja": `${author}: ${text}` },
          url: "https://kuroneko-family-chat.vercel.app/" // アプリを開くURL
        })
      });
    } catch (err) {
      console.error("Push notification error:", err);
    }
  };

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
      localStorage.setItem('userIcon', userIcon);
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
      userIcon: userIcon,
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

    // 通知を飛ばす
    sendPushNotification(userName, inputValue.trim());

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

  const askGemini = async (currentHistory, modelIndex = 0, retryCount = 0) => {
    if (!GEMINI_API_KEY) {
      addCatMessage("APIキーが設定されておらぬぞ！.envファイルを確認せい！", currentHistory);
      return;
    }

    const MODELS = [
      "gemini-2.5-flash-lite",
      "gemini-2.5-flash",
      "gemini-3-flash-preview"
    ];

    const modelName = MODELS[modelIndex] || MODELS[0];

    // 最新20件の履歴をGeminiの形式に変換
    const promptHistory = currentHistory.slice(-20).map(m => {
      return {
        role: m.isCat ? "model" : "user",
        // 黒猫自身の過去の発言にはカッコを付けず、人間の発言にだけ名前を付けて送る（AIの真似を防ぐため）
        parts: [{ text: m.isCat ? m.text : `${m.author}「${m.text}」` }]
      };
    });

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: promptHistory,
          system_instruction: { parts: [{ text: SYSTEM_INSTRUCTION }] }
        })
      });

      const data = await response.json();

      if (data.candidates && data.candidates[0]) {
        const replyText = data.candidates[0].content.parts[0].text;
        addCatMessage(replyText, currentHistory);
        // 猫の返信も通知する
        sendPushNotification("黒猫の神様", replyText);
      } else if (data.error && (data.error.code === 429 || data.error.code === 503)) {
        if (retryCount < 2) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          await askGemini(currentHistory, modelIndex, retryCount + 1);
        } else if (modelIndex < MODELS.length - 1) {
          await askGemini(currentHistory, modelIndex + 1, 0);
        } else {
          addCatMessage("我は今とても忙しいのじゃ……また後で呼ぶがよい！", currentHistory);
        }
      } else if (data.error) {
        addCatMessage(`通信エラーじゃ！（${data.error.message}）`, currentHistory);
      } else {
        addCatMessage("むむ……我も少し疲れたわい。（予期せぬエラー）", currentHistory);
      }
    } catch (error) {
      if (retryCount < 2) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        await askGemini(currentHistory, modelIndex, retryCount + 1);
      } else if (modelIndex < MODELS.length - 1) {
        await askGemini(currentHistory, modelIndex + 1, 0);
      } else {
        addCatMessage(`通信エラーじゃ！ ${error.message}`, currentHistory);
      }
    }
  };

  const addCatMessage = (text, history) => {
    const catMsg = {
      id: Date.now(),
      author: '黒猫',
      userIcon: 'cat',
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
        <img src="/icon-square.png" alt="黒猫" style={{ width: 60, height: 60, borderRadius: '50%', marginBottom: 15 }} />
        
        <form onSubmit={handleJoin} style={{ width: '100%', textAlign: 'center' }}>
          <div className="input-group">
            <label>おなまえ（4文字まで）</label>
            <input 
              name="name" 
              type="text" 
              defaultValue={userName} 
              placeholder="なまえ" 
              required 
              maxLength={4}
              autoComplete='off' 
            />
          </div>

          <p className="selection-label">アイコンを選んでね</p>
          <div className="icon-selector">
            {USER_ICONS.map(icon => (
              <div 
                key={icon.id} 
                className={`icon-option ${userIcon === icon.id ? 'selected' : ''}`}
                onClick={() => setUserIcon(icon.id)}
              >
                <img src={icon.src} alt={icon.name} />
              </div>
            ))}
          </div>

          <button type="submit" className="login-btn">入室</button>
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
          // アイコンのURLを取得
          const iconInfo = USER_ICONS.find(i => i.id === msg.userIcon);
          const iconSrc = isCat ? "/icon-square.png" : (iconInfo ? iconInfo.src : "/icons/papa.png");

          return (
            <div key={msg.id} className={`message-row ${isMe ? 'me' : 'other'} ${isCat ? 'cat' : ''}`}>
              {!isMe && (
                <div className="avatar-container">
                    <img src={iconSrc} className="avatar-img" alt={isCat ? "黒猫" : msg.author} />
                    <div className="sender-name">{isCat ? "黒猫" : msg.author}</div>
                </div>
              )}
              {isMe && (
                <div className="avatar-container me-avatar">
                    <img src={iconSrc} className="avatar-img" alt="me" />
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
               <img src="/icon-square.png" className="avatar-img" alt="猫" />
               <div className="sender-name">黒猫</div>
            </div>
            <div className="bubble thinking">フンッ…考え中じゃ…</div>
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
