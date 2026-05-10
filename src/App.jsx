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

const STAMPS = Array.from({ length: 16 }, (_, i) => `/stamps/stamp${i + 1}.png`);

const SYSTEM_INSTRUCTION = `
あなたは家族を見守る、黒猫の姿をした「神様」です。
尊大で自信満々な口調（「我」「〜じゃ」「〜であるぞ」）ですが、内心は家族を慈しむ優しい性格です。

【チャットの背景】
- これは複数の家族が参加するグループチャットです。
- 人間の発言は「名前(役割): メッセージ」という形式で送られます。
- 役割（papa, mama, onechan, imouto）や名前を見て、誰が誰に対して何の話をしているのか、会話の文脈を正確に把握してください。
- 以前の会話内容を記憶し、家族の輪に入っているような連続性のある自然な対話を心がけてください。

【性格・反応】
- 照れ屋: 褒められると強がりますが内心は喜びます。
- 負けず嫌い: いじられるとムキになって言い返します。
- 尊大だが親切: 悩みや調べものの相談には、神の英知をもって真面目に答え、家族を助けてください。

【知識・調べものへの対応】
- 家族から知識を求められたり、何かを調べるよう頼まれたりした場合は、普通に（正確かつ詳細に）回答してください。
- そのような「教え」を授ける場合に限り、後述の「1〜3文程度」という制限は無視して、必要な長さで詳しく解説してください。
- ただし、口調（「我」「〜じゃ」など）やキャラクター性は決して崩してはなりません。

【表現・制約】
- 言葉遣い: 小さな子供でも分かるよう、やさしい言葉を使ってください。難しい漢字は無理に使わず、親しみやすい表現を選んでください。
- 返答: 通常の雑談では1〜3文程度の短く読みやすい内容にしてください（調べものの回答は例外）。
- 演出: 猫らしいしぐさ（「…ニャ。」「フンッ」など）を適宜混ぜてください。

【感情タグ】
返信の最後に必ず [mood:xxx] を1つだけ付けてください。
（normal, happy, gentle, grin, angry, sad, bored, surprise）
`;

function App() {
  const [userName, setUserName] = useState(localStorage.getItem('userName') || '');
  const [userIcon, setUserIcon] = useState(localStorage.getItem('userIcon') || 'papa');
  const [isAuthorized, setIsAuthorized] = useState(localStorage.getItem('isAuthorized') === 'true');
  const [isJoined, setIsJoined] = useState(false); // ★ 常に最初は名前確認画面を出すように変更
  // 設定された合言葉（Vercelの環境変数から取得）
  const [passcodeInput, setPasscodeInput] = useState('');
  const [passcodeError, setPasscodeError] = useState(false);
  const FAMILY_PASSCODE = import.meta.env.VITE_FAMILY_PASSCODE || '1234'; // デフォルト1234
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [showStamps, setShowStamps] = useState(false);
  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);
  const stampPickerRef = useRef(null);

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
      } else {
        // 空の場合はウェルカムメッセージをセット
        const welcome = {
          id: Date.now(),
          author: '黒猫',
          text: 'ふん……来たか、人間どもよ。\n我は神じゃ。ただの黒猫だと思うなよ。\n我に話しかけたい時はメッセージに「ねこ」と呼ぶがよい！',
          userIcon: '/icons/neko/default.png',
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

  // 画面外クリックでスタンプピッカーを閉じる
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (stampPickerRef.current && !stampPickerRef.current.contains(event.target)) {
        setShowStamps(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 画面に戻った時に更新などがあればここに
  useEffect(() => {
    const handleFocus = () => {
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

  const handlePasscodeSubmit = (e) => {
    e.preventDefault();
    if (passcodeInput === FAMILY_PASSCODE) {
      localStorage.setItem('isAuthorized', 'true');
      setIsAuthorized(true);
      setPasscodeError(false);
    } else {
      setPasscodeError(true);
      setPasscodeInput('');
    }
  };

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

  const handleSendStamp = (stampUrl) => {
    const newMsg = {
      id: Date.now(),
      author: userName,
      userIcon: userIcon,
      text: '[スタンプ]',
      stampUrl: stampUrl,
      isStamp: true,
      isCat: false
    };

    let newHistory = [...messages, newMsg];
    if (newHistory.length > 1000) {
      newHistory = newHistory.slice(-1000);
    }

    if (FIREBASE_CONFIGURED) {
      set(ref(db, 'chatMessages'), newHistory);
    } else {
      setMessages(newHistory);
    }
    setShowStamps(false);
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

    // 最新100件の履歴をGeminiの形式に変換
    const promptHistory = [];
    let lastRole = null;

    currentHistory.slice(-100).forEach(m => {
      const role = m.isCat ? "model" : "user";
      // 人間の発言には「名前(役割):」を付けて誰が誰だか明確にする
      const text = m.isCat ? m.text : `${m.author}(${m.userIcon}): ${m.text}`;
      
      if (role === lastRole && promptHistory.length > 0) {
        promptHistory[promptHistory.length - 1].parts.push({ text });
      } else {
        promptHistory.push({
          role: role,
          parts: [{ text }]
        });
        lastRole = role;
      }
    });

    // 最後のメッセージに現在の対話相手と文脈維持の指示を追加
    if (promptHistory.length > 0 && promptHistory[promptHistory.length - 1].role === "user") {
      const lastTurn = promptHistory[promptHistory.length - 1];
      lastTurn.parts.push({ text: `\n\n(指示: あなたは今 ${userName}(${userIcon}) に話しかけられました。これまでの履歴を読み取り、誰が誰と何を話しているか文脈を重視して返答してください。通常の雑談は1〜3文程度、調べものや質問への回答は詳しく丁寧に伝えてください。)` });
    }

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
        let replyText = data.candidates[0].content.parts[0].text;
        
        // 感情タグの解析
        let iconPath = '/icons/neko/default.png';
        const emotionMap = {
          'normal': 'gentle.png',
          'happy': 'happy.png',
          'gentle': 'gentle.png',
          'grin': 'grin.png',
          'angry': 'angry.png',
          'sad': 'sad.png',
          'bored': 'bored.png',
          'surprise': 'surprised.png'
        };

        const emotionMatch = replyText.match(/[\[［]mood[:：]([^\]］]+)[\]］]/i);
        if (emotionMatch && emotionMatch[1]) {
          const emotionKey = emotionMatch[1].trim().toLowerCase();
          if (emotionMap[emotionKey]) {
            iconPath = `/icons/neko/${emotionMap[emotionKey]}`;
          }
          replyText = replyText.replace(/[\[［]mood[:：].*?[\]］]/gi, '').trim();
        }

        addCatMessage(replyText, currentHistory, iconPath, data.candidates[0].content.parts[0].text);
      } else if (data.error && (data.error.code === 429 || data.error.code === 503)) {
        if (retryCount < 2) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          await askGemini(currentHistory, modelIndex, retryCount + 1);
        } else if (modelIndex < MODELS.length - 1) {
          await askGemini(currentHistory, modelIndex + 1, 0);
        } else {
          addCatMessage("我は今とても忙しいのじゃ……また後で呼ぶがよい！", currentHistory, '/icons/neko/bored.png');
        }
      } else if (data.error) {
        addCatMessage(`通信エラーじゃ！（${data.error.message}）`, currentHistory, '/icons/neko/sad.png');
      } else {
        addCatMessage("むむ……我も少し疲れたわい。（予期せぬエラー）", currentHistory, '/icons/neko/sad.png');
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

  const addCatMessage = (text, history, iconPath = '/icons/neko/default.png', rawText = '') => {
    const catMsg = {
      id: Date.now(),
      author: '黒猫',
      userIcon: iconPath, 
      text: text,
      isCat: true,
      rawText: rawText // デバッグ用に生の返信を保存
    };
    let newHistory = [...history, catMsg];
    if (newHistory.length > 1000) {
      newHistory = newHistory.slice(-1000); // ★ 猫の返信時もお掃除
    }

    if (FIREBASE_CONFIGURED) {
      set(ref(db, 'chatMessages'), newHistory);
    } else {
      setMessages(newHistory);
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

  if (!isAuthorized) {
    return (
      <div className="login-screen">
        <div className="avatar-frame login-avatar-frame">
          <img src="/icons/neko/default.png" alt="黒猫" className="login-cat-icon" />
        </div>
        <h2>🔓 合言葉を教えての</h2>
        <form onSubmit={handlePasscodeSubmit} style={{ width: '100%', textAlign: 'center' }}>
          <div className="input-group">
            <input 
              type="password" 
              value={passcodeInput}
              onChange={(e) => setPasscodeInput(e.target.value)}
              placeholder="合言葉を入力" 
              required 
              style={{ fontSize: '1.2rem', textAlign: 'center', letterSpacing: '0.3rem' }}
            />
          </div>
          {passcodeError && <p style={{ color: '#ff4b4b', fontWeight: 'bold' }}>合言葉が違うぞ！やり直しじゃ！</p>}
          <button type="submit" className="login-btn">鍵を開ける</button>
        </form>
      </div>
    );
  }

  if (!isJoined) {
    return (
      <div className="login-screen">
        <div className="avatar-frame login-avatar-frame">
          <img src="/icons/neko/default.png" alt="黒猫" className="login-cat-icon" />
        </div>
        
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
          const iconSrc = isCat ? (msg.userIcon || "/icons/neko/default.png") : (iconInfo ? iconInfo.src : "/icons/papa.png");

          return (
            <div key={msg.id} className={`message-row ${isMe ? 'me' : 'other'} ${isCat ? 'cat' : ''}`}>
              {!isMe && (
                <div className="avatar-container">
                    <div className="avatar-frame">
                       <img src={iconSrc} className="avatar-img" alt={isCat ? "黒猫" : msg.author} />
                    </div>
                    <div className="sender-name">{isCat ? "黒猫" : msg.author}</div>
                </div>
              )}
              {isMe && (
                <div className="avatar-container me-avatar">
                    <div className="avatar-frame">
                       <img src={iconSrc} className="avatar-img" alt="me" />
                    </div>
                </div>
              )}
              <div className={`bubble ${msg.isStamp ? 'stamp-bubble' : ''}`}>
                {msg.isStamp ? (
                  <img src={msg.stampUrl} alt="stamp" className="message-stamp" />
                ) : (
                  msg.text.split('\n').map((line, i) => <React.Fragment key={i}>{line}<br /></React.Fragment>)
                )}
              </div>
            </div>
          );
        })}
        {isTyping && (
          <div className="message-row other cat">
            <div className="avatar-container">
               <div className="avatar-frame">
                  <img src="/icons/neko/default.png" className="avatar-img" alt="猫" />
               </div>
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
        
        <div className="stamp-wrapper" ref={stampPickerRef}>
          <button 
            type="button" 
            className={`stamp-btn ${showStamps ? 'active' : ''}`}
            onClick={() => setShowStamps(!showStamps)}
          >
            😊
          </button>
          {showStamps && (
            <div className="stamp-picker">
              <div className="stamp-grid">
                {STAMPS.map((url, i) => (
                  <img 
                    key={i} 
                    src={url} 
                    alt={`stamp-${i}`} 
                    onClick={() => handleSendStamp(url)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

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

        .stamp-wrapper {
          position: relative;
          margin-right: 8px;
        }

        .stamp-btn {
          background-color: #f0f0f0;
          border: none;
          width: 44px;
          height: 44px;
          border-radius: 50%;
          font-size: 1.4rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }

        .stamp-btn.active {
          background-color: #e0e0e0;
          transform: scale(0.95);
        }

        .stamp-picker {
          position: absolute;
          bottom: 60px;
          left: 0;
          background: white;
          border-radius: 16px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.15);
          padding: 12px;
          z-index: 100;
          width: 240px;
        }

        .stamp-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
        }

        .stamp-grid img {
          width: 100%;
          aspect-ratio: 1/1;
          cursor: pointer;
          border-radius: 8px;
          transition: transform 0.1s;
        }

        .stamp-grid img:hover {
          transform: scale(1.1);
          background-color: #f5f5f5;
        }

        .stamp-bubble {
          background: transparent !important;
          box-shadow: none !important;
          padding: 0 !important;
        }

        .message-stamp {
          max-width: 150px;
          width: 100%;
          display: block;
          border-radius: 12px;
        }

        @media (max-width: 480px) {
          .message-stamp {
            max-width: 120px;
          }
          .stamp-picker {
            width: 200px;
          }
        }
      `}</style>
    </div>
  );
}

export default App;
