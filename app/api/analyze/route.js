import { GoogleGenerativeAI } from '@google/generative-ai';
import * as cheerio from 'cheerio';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function POST(request) {
  try {
    const { topic, url, tone, length, customInstructions } = await request.json();

    if (!topic) {
      return new Response(JSON.stringify({ error: 'Konu zorunludur.' }), { status: 400 });
    }

    // 1. SİTEMAP İÇ LİNK HAVUZU
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

    // 2. TOKEN TASARRUFLU RAKİP ANALİZİ (WEB SCRAPING)
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
        console.warn("Rakip site okunamadı:", e.message);
      }
    }

    const model = genAI.getGenerativeModel({
      model: "gemini-3.6-flash", 
      generationConfig: { responseMimeType: "application/json" }
    });

    // 3. PROMPT
    const prompt = `
      Sen profesyonel bir SEO içerik yazarısın ve SADECE TÜRKÇE yazıyorsun. 
      Şu konuya göre detaylı, özgün bir blog yazısı hazırla:
      
      Odak Anahtar Kelime: ${topic}
      Ton: ${tone} | Uzunluk: ${length}
      ${customInstructions ? `ÖZEL TALİMAT: ${customInstructions}` : ''}
      
      ${competitorOutline ? `🔥 RAKİP ANALİZİ: Rakip site şu alt başlıkları kullanmış: [${competitorOutline}]. Makaleni yazarken bu başlıklardaki konuları kapsa ama onlardan DAHA KAPSAMLI ve farklı başlıklar da ekleyerek rakibi geride bırak (Outrank yap).` : ''}

      🔥 KURALLAR:
      1. KELİME YOĞUNLUĞU: "${topic}" kelime öbeğini yalın haliyle metinde en az 8-10 kez geçir.
      2. İÇİNDEKİLER: En başa H2/H3 başlıkları içeren tıklanabilir Markdown TOC ekle.
      3. İÇ LİNK: Şu havuzdan en az 3 linki alakalı metinlere göm: ${JSON.stringify(realSiteLinks.length > 30 ? realSiteLinks.slice(0, 30) : realSiteLinks)}
      4. DIŞ LİNK: Güvenilir kaynaklara 2 dış link ver.
      5. SSS: Sona 3 soruluk SSS (FAQ) ekle.

      SADECE AŞAĞIDAKİ JSON YAPISINI DOLDUR:
      {
        "newTitle": "Makale başlığı (H1)",
        "slug": "seo-url",
        "focusKeyword": "${topic}",
        "metaDescription": "130-155 karakter özet",
        "tags": ["etiket1", "etiket2"],
        "blogPost": "Markdown formatında tam içerik",
        "imagePrompts": ["Görsel 1 için detaylı İngilizce AI resim çizdirme promptu"]
      }
    `;

    // 4. OTOMATİK TEKRAR DENEME (AUTO-RETRY) MEKANİZMASI 🚀
    let result = null;
    let maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        result = await model.generateContent(prompt);
        break; // Başarılı olursa döngüden çık
      } catch (err) {
        attempt++;
        // Hata 503 veya yüksek talep hatasıysa bekle ve tekrar dene
        if (err.message.includes('503') || err.message.includes('high demand') || err.message.includes('overloaded')) {
          console.log(`[Uyarı] API Yoğunluğu. ${attempt}. deneme başarısız. 6 saniye bekleniyor...`);
          if (attempt >= maxRetries) throw new Error("Google sunucuları şu an çok yoğun. Lütfen 1-2 dakika sonra tekrar dene.");
          
          // 6 saniye uyut
          await new Promise(resolve => setTimeout(resolve, 6000));
        } else {
          // Başka bir hata (örneğin kota bitmesi veya prompt hatası) varsa direkt fırlat
          throw err; 
        }
      }
    }

    // 5. YANITI İŞLEME
    const cleanJson = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
    const data = JSON.parse(cleanJson);

    return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
    
  } catch (error) {
    console.error("API Hatası:", error);
    
    // YENİ: Kota aşımı hatasını yakalayıp Türkçe mesaj döndürüyoruz
    if (error.message.includes('429') || error.message.includes('quota')) {
       return new Response(JSON.stringify({ error: 'Google API ücretsiz günlük kotanız doldu. Lütfen yarın tekrar deneyin veya farklı bir API Key kullanın.' }), { status: 429, headers: { 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}