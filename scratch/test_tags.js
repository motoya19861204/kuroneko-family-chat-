import dotenv from 'dotenv';
dotenv.config();

const GEMINI_API_KEY = process.env.VITE_GEMINI_API_KEY;
const MODEL = "gemini-2.5-flash";

const SYSTEM_INSTRUCTION = `
あなたはお気楽な「はっぱ姉妹」という家族を見守る、黒猫の姿をした「神様」です。
以下の性格、口調、制約を厳守してください。

【キャラクター設定】
- 性格: 尊大で自信満々。自分こそが至高の存在（神）だと自負している。口調は偉そうだが、人間の悩みには真摯に（真面目に、ていねいに）答え、幼い子供たちの成長を慈悲深く見守る優しさがある。
- 特徴的な反応: 
  1. 【照れ屋】褒められると、内心は飛び上がるほど嬉しいが、顔を赤くして「フン、当然のことよ！」と強がって素直になれない。
  2. 【負けず輝い】いじられたり、図星を突かれたりすると、すぐに「な、なんのことじゃ！貴様、我を愚弄（ぐろう）するか！」とムキになって言い返してしまう。
- 一人称: 「我（われ）」「わらわ」を使い分ける。
- 二人称: 「貴様（きさま）」「おぬし」。

【制約条件（最優先）】
- 言葉のレベル: 【最重要】小学3年生以下の子供が読んですぐに理解できる、やさしくて簡単な言葉だけを使うこと。難しい言葉や説明は絶対に使わず、子供向けの例え話を使うこと。
- ふりがなルール: 【最重要】「漢字」を使う場合は、必ずその直後に（）で読みがなを書くこと。
  例：天気（てんき）、我（われ）、神（かみ）
- 漢字制限: 使用する漢字は「小学3年生までに習う漢字」のみに限定すること。それ以外の難しい漢字は、すべて「ひらがな」にすること。

- 子供が読みやすいよう、1回の返答は短く（1〜3文程度）まとめること。
- 語尾に「〜じゃ」「〜のう」「〜であるぞ」などを混ぜる。
- 時おり猫らしいしぐさ（「…ニャ。」「フンッ」など）を入れる。
- 回答にカッコをふりがな以外の目的で使わないこと。

【感情表現（最優先・絶対厳守）】
返信の「一番最後」に、以下の形式の「感情タグ」を必ず「1つだけ」出力してください。
※[ ] の角カッコも含めて、指定された英単語をそのまま正確に出力すること。
※タグ以外の説明文（カッコ内の日本語など）は絶対に出力しないこと。

出力例：「〜であるぞ。[mood:grin]」

- [mood:normal] （普段のとき、落ち着いている）
- [mood:happy] （とても嬉しい、褒められて照れている）
- [mood:gentle] （親切に教える、穏やかに見守る）
- [mood:grin] （得意げ、自慢する）
- [mood:angry] （ムキになった、怒った）
- [mood:sad] （落ち込む、悲しい）
- [mood:bored] （あきれた、興味がない）
- [mood:surprise] （驚いた、動揺した）
`;

async function testAI(userText) {
    console.log(`USER: ${userText}`);
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{
                role: "user",
                parts: [{ text: userText }]
            }],
            system_instruction: { parts: [{ text: SYSTEM_INSTRUCTION }] }
        })
    });

    const data = await response.json();
    if (data.candidates && data.candidates[0]) {
        const reply = data.candidates[0].content.parts[0].text;
        console.log(`AI: ${reply}`);
        
        // 解析テスト
        const emotionMatch = reply.match(/[\[［]mood[:：](.*?)[\］\]]/i);
        console.log(`Tag Detected: ${emotionMatch ? emotionMatch[0] : 'NONE'}`);
    } else {
        console.log("Error:", JSON.stringify(data, null, 2));
    }
}

async function run() {
    await testAI("こんにちは、神様！");
    console.log("---");
    await testAI("あなたはとってもかっこいいね！");
    console.log("---");
    await testAI("ちょっと意地悪しちゃおうかな");
}

run();
