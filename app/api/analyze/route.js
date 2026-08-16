import { GoogleGenerativeAI } from '@google/generative-ai';
import * as cheerio from 'cheerio';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function POST(request) {
  try {
    const { topic, url, tone, length, customInstructions } = await request.json();

    if (!topic) {
      return new Response(JSON.stringify({ error: 'Konu zorunludur.' }), { status: 400 });
    }

    let realSiteLinks = [];
    try {
      const sitemapRes = await fetch('https://matemetrik.com/sitemap.xml');
      if (sitemapRes.ok) {
        const sitemapText = await sitemapRes.text();
        const matches = sitemapText.match(/<loc>(.*?)<\/loc>/g);
        if (matches) {
          realSiteLinks = matches
            .map(m => m.replace(/<\/?loc>/g, ''))
            .filter(link => !link.endsWith('.xml') && link !== 'https://matemetrik.com/'); 
        }
      }
    } catch (e) {
      console.warn("Sitemap çekilemedi.");
      realSiteLinks = ["https://matemetrik.com/"];
    }

    let competitorOutline = "";
    if (url) {
      try {
        const urlRes = await fetch(url);
        const html = await urlRes.text();
        const $ = cheerio.load(html);
        let headings = [];
        $('h1, h2, h3').each((i, el) => {
          headings.push($(el).text().trim());
        });
        competitorOutline = headings.slice(0, 15).join(', ');
      } catch (e) {
        console.warn("Rakip site okunamadı:");
      }
    }

    const model = genAI.getGenerativeModel({
      model: "gemini-3.6-flash", 
      generationConfig: { responseMimeType: "application/json" }
    });

    const prompt = `
      Sen profesyonel bir SEO içerik yazarısın ve SADECE TÜRKÇE yazıyorsun. 
      Şu konuya göre detaylı, özgün bir blog yazısı hazırla:
      
      Odak Anahtar Kelime: ${topic}
      Ton: ${tone} | Uzunluk: ${length}
      ${customInstructions ? `ÖZEL TALİMAT: ${customInstructions}` : ''}
      
      ${competitorOutline ? `🔥 RAKİP ANALİZİ: Rakip site şu alt başlıkları kullanmış: [${competitorOutline}]. Bunlardan daha kapsamlı bir içerik üret.` : ''}

      🔥 KURALLAR:
      1. MATEMATİK FORMÜLLERİ: Metin içindeki TÜM matematiksel ifadeler, denklemler ve semboller için KESİNLİKLE LaTeX formatı kullan. Satır içi (inline) formüllerde $, blok (block) formüllerde $$ sembollerini kullan.
      2. YASAKLAR: KESİNLİKLE "İçindekiler" tablosu veya <a id="..."> html etiketleri kullanma.
      3. İÇ LİNK: Şu havuzdan en az 3 linki alakalı metinlere göm: ${JSON.stringify(realSiteLinks.length > 30 ? realSiteLinks.slice(0, 30) : realSiteLinks)}

      SADECE AŞAĞIDAKİ JSON YAPISINI DOLDUR:
      {
        "newTitle": "Makale başlığı (H1)",
        "slug": "seo-url",
        "focusKeyword": "${topic}",
        "metaDescription": "130-155 karakter özet",
        "tags": ["etiket1", "etiket2"],
        "blogPost": "Markdown formatında tam içerik",
        "socialMedia": {
          "twitter": "Bu makale için dikkat çekici, emojili ve hashtagli bir Tweet dizisi (Thread) hazırla.",
          "instagram": "Bu makale için eğitim odaklı, dikkat çekici bir Instagram gönderi açıklaması ve popüler matematik hashtagleri hazırla."
        }
      }
    `;

    let result = null;
    let maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        result = await model.generateContent(prompt);
        break; 
      } catch (err) {
        attempt++;
        if (err.message.includes('503') || err.message.includes('high demand') || err.message.includes('overloaded')) {
          if (attempt >= maxRetries) throw new Error("Google sunucuları şu an çok yoğun. Lütfen bekleyip tekrar dene.");
          await new Promise(resolve => setTimeout(resolve, 6000));
        } else {
          throw err; 
        }
      }
    }

    const cleanJson = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
    const data = JSON.parse(cleanJson);

    return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
    
  } catch (error) {
    if (error.message.includes('429') || error.message.includes('quota')) {
       return new Response(JSON.stringify({ error: 'Google API ücretsiz günlük kotanız doldu.' }), { status: 429, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}