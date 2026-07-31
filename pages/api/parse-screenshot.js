import { GoogleGenAI } from '@google/genai';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { imageBase64, mimeType } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: '找不到圖片資料' });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: [
        {
          inlineData: {
            data: imageBase64,
            mimeType: mimeType || 'image/png',
          },
        },
        {
          text: `你是一個專業的楓之谷 Artale 遊戲截圖解析助手。請從這張截圖中精準提取以下三個數據：
          1. 玩家角色名稱 (char_id)：尋找畫面中的角色 ID（例如 Apple 或 路C歐歐歐）。
          2. 當前等級 (level)：尋找 LV. 後方的數字（例如 186 或 167）。
          3. 當前經驗值 (exp_val)：尋找 EXP 欄位或經驗值條中、位於 "[" 符號前面的那串整數（絕對不要抓 HP 或 MP 的數值！）。

          請嚴格以純 JSON 格式回傳，不要包含任何 Markdown 語法或其他文字，格式如下：
          {"char_id": "找到的名字", "level": 數字, "exp_val": 數字}`
        },
      ],
    });

    const textResult = response.text.trim();
    const cleanJsonStr = textResult.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsedData = JSON.parse(cleanJsonStr);

    return res.status(200).json(parsedData);
  } catch (err) {
    console.error('Gemini 視覺辨識失敗:', err);
    return res.status(500).json({ error: 'AI 解析圖片失敗：' + err.message });
  }
}
