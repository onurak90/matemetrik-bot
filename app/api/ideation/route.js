import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function POST(request) {
  try {
    const { topic } = await request.json();

    if (!topic) {
      return new Response(JSON.stringify({ error: 'Konu zorunludur.' }), { status: 400 });
    }

    // Google'ın senin anahtarına izin verdiği 3.6-flash modelini kullanıyoruz
    const model = genAI.getGenerativeModel({
      model: "gemini-3.6-flash", 
      generationConfig: { responseMimeType: "application/json" }
    });

    const prompt = `
      Sen profesyonel bir SEO ve içerik stratejistisin.
      Kullanıcı web sitesi için "${topic}" nişinde/konusunda blog yazıları yazmak istiyor.
      Bu ana konuyla ilgili Google'da çok aranan, SEO rekabeti düşük ama tıklama oranı (CTR) yüksek 5 adet harika makale başlığı / konu fikri üret.
      
      SADECE AŞAĞIDAKİ JSON YAPISINI DOLDURARAK YANIT VER:
      {
        "ideas": [
          "Konu Fikri 1",
          "Konu Fikri 2",
          "Konu Fikri 3",
          "Konu Fikri 4",
          "Konu Fikri 5"
        ]
      }
    `;

    const result = await model.generateContent(prompt);
    const cleanJson = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
    const data = JSON.parse(cleanJson);

    return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
    
  } catch (error) {
    console.error("Fikir Üretme Hatası:", error);
    if (error.message.includes('429') || error.message.includes('quota')) {
       return new Response(JSON.stringify({ error: 'Kota doldu. Lütfen API anahtarınızı kontrol edin.' }), { status: 429 });
    }
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}