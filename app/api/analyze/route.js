import { GoogleGenerativeAI } from '@google/generative-ai';
import * as cheerio from 'cheerio';
import sharp from 'sharp';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function POST(request) {
  try {
    const { topic, url, tone, length, customInstructions, mode, bulkTopics } = await request.json();

    let topicsList = [];
    if (mode === 'bulk' && Array.isArray(bulkTopics) && bulkTopics.length > 0) {
      topicsList = bulkTopics.map(t => t.trim()).filter(Boolean);
    } else {
      if (!topic) {
        return new Response(JSON.stringify({ error: 'Konu zorunludur.' }), { status: 400 });
      }
      topicsList = [topic];
    }

    let competitorOutline = "";
    if (url && topicsList.length === 1) {
      try {
        const urlRes = await fetch(url);
        const html = await urlRes.text();
        const $ = cheerio.load(html);
        let headings = [];
        $('h1, h2, h3').each((i, el) => {
          headings.push($(el).text().trim());
        });
        competitorOutline = headings.slice(0, 15).join(', ');
      } catch (e) {}
    }

    const model = genAI.getGenerativeModel({
      model: "gemini-3.6-flash", 
      generationConfig: { 
        responseMimeType: "application/json",
        temperature: 0.7 
      }
    });

    let processedResults = [];

    for (const currentTopic of topicsList) {
      const prompt = `
        Sen profesyonel bir SEO içerik yazarısın ve SADECE TÜRKÇE yazıyorsun. 
        Şu konuya göre detaylı, özgün bir blog yazısı hazırla:
        
        Odak Anahtar Kelime: ${currentTopic}
        Yazım Tarzı: ${tone || 'Bilgilendirme'} | Uzunluk: ${length || 'Orta (600 kelime)'}
        ${customInstructions ? `ÖZEL TALİMAT: ${customInstructions}` : ''}
        
        ${competitorOutline ? `🔥 RAKİP ANALİZİ: Rakip site şu alt başlıkları kullanmış: [${competitorOutline}]. Bunlardan daha kapsamlı bir içerik üret.` : ''}

        🔥 KURALLAR VE ZORUNLU GÖREVLER:
        1. MATEMATİKSEL İFADELER / FORMÜLLER: SADECE konu doğrudan matematik veya fizik ile ilgiliyse LaTeX formülü kullan. Konu matematik/fizik değilse KESİNLİKLE formül veya denklem KULLANMA.
        2. İÇ LİNK: KESİNLİKLE İÇ LİNK KULLANMA. İç linkleme yapmak yasaktır.
        3. DIŞ LİNK (ZORUNLU): Konuyla ilgili güvenilir dış kaynaklara en az 2 adet Markdown dış link ver.
        4. GEMİNİ GÖRSEL ÜRETİMİ: Konuyla BİREBİR örtüşen, profesyonel bir kapak görseli için detaylı bir İngilizce görsel promptu (\`imagePrompt\`) hazırla.
        5. İNSTAGRAM PROMPTLARI: Kaydırmalı 3 adet Instagram slaytı için konuyu nokta atışı anlatan, içinde başlık ve özet maddeler barındıran profesyonel İngilizce görsel promptları (\`instagramPromptSlides\`) hazırla.
        6. YASAKLAR: "İçindekiler" tablosu veya HTML anchor tag'leri kullanma. JSON içinde asla bozuk tırnak kullanma.

        SADECE AŞAĞIDAKİ GEÇERLİ JSON FORMATINI DOLDUR (Başka hiçbir metin veya açıklama ekleme):
        {
          "newTitle": "Makale basligi",
          "slug": "seo-url",
          "focusKeyword": "${currentTopic}",
          "metaDescription": "130-155 karakter özet",
          "tags": ["etiket1", "etiket2"],
          "blogPost": "Markdown formatinda, İÇ LİNK OLMADAN, sadece dış linkler barındıran tam içerik",
          "imagePrompt": "Gemini tarafından konuya özel olarak üretilmiş, detaylı ve bağlamsal İngilizce kapak görseli promptu, modern aesthetic, 8k",
          "socialMedia": {
            "twitter": "X platformu için detaylı, uzun ve etkileyici flood / gönderi metni.",
            "instagramCaption": "Instagram'da görselin altına yazılacak açıklama ve hashtagler.",
            "instagramPromptSlides": [
              {
                "slideNo": 1,
                "imageGenPrompt": "Professional square 1:1 infographic design for Instagram carousel, directly related to the topic, featuring main title and summary points."
              },
              {
                "slideNo": 2,
                "imageGenPrompt": "Professional square 1:1 infographic design for Instagram carousel, directly related to the topic, featuring subtitle and detailed descriptive points."
              },
              {
                "slideNo": 3,
                "imageGenPrompt": "Professional square 1:1 infographic design for Instagram carousel, directly related to the topic, featuring conclusion header and checklist."
              }
            ]
          }
        }
      `;

      let result = await model.generateContent(prompt);
      let rawText = result.response.text();
      
      let cleanJson = rawText.trim();
      if (cleanJson.startsWith("```json")) {
        cleanJson = cleanJson.replace(/^```json/, "").replace(/```$/, "").trim();
      } else if (cleanJson.startsWith("```")) {
        cleanJson = cleanJson.replace(/^```/, "").replace(/```$/, "").trim();
      }
      
      let data;
      try {
        data = JSON.parse(cleanJson);
      } catch (parseErr) {
        try {
          const fixedText = cleanJson.replace(/[\u0000-\u001F\u007F-\u009F]/g, "").replace(/,\s*}/g, "}").replace(/,\s*]/g, "]");
          data = JSON.parse(fixedText);
        } catch (secondErr) {
          throw new Error(`'${currentTopic}' için yapay zeka yanıtı JSON formatına uymadı.`);
        }
      }

      // SEO Analizi
      const textContent = data.blogPost || "";
      const wordCount = textContent.split(/\s+/).filter(Boolean).length;
      const keywordRegex = new RegExp(currentTopic, "gi");
      const keywordMatches = textContent.match(keywordRegex);
      const keywordCount = keywordMatches ? keywordMatches.length : 0;
      const keywordDensity = wordCount > 0 ? ((keywordCount / wordCount) * 100).toFixed(2) : 0;

      let seoScore = 100;
      let seoChecks = [];

      if (wordCount >= 400) {
        seoChecks.push({ label: "Kelime Sayısı", status: "İyi", desc: `${wordCount} kelime` });
      } else {
        seoScore -= 20;
        seoChecks.push({ label: "Kelime Sayısı", status: "Geliştirilmeli", desc: `${wordCount} kelime` });
      }

      const titleLen = data.newTitle ? data.newTitle.length : 0;
      if (titleLen >= 30 && titleLen <= 65) {
        seoChecks.push({ label: "Başlık Uzunluğu (H1)", status: "Mükemmel", desc: `${titleLen} karakter` });
      } else {
        seoScore -= 15;
        seoChecks.push({ label: "Başlık Uzunluğu (H1)", status: "Uyarı", desc: `${titleLen} karakter` });
      }

      const metaLen = data.metaDescription ? data.metaDescription.length : 0;
      if (metaLen >= 130 && metaLen <= 155) {
        seoChecks.push({ label: "Meta Açıklama", status: "Mükemmel", desc: `${metaLen} karakter` });
      } else {
        seoScore -= 15;
        seoChecks.push({ label: "Meta Açıklama", status: "Uyarı", desc: `${metaLen} karakter` });
      }

      if (keywordDensity >= 0.5 && keywordDensity <= 3.0) {
        seoChecks.push({ label: "Anahtar Kelime Yoğunluğu", status: "Mükemmel", desc: `%${keywordDensity}` });
      } else {
        seoScore -= 15;
        seoChecks.push({ label: "Anahtar Kelime Yoğunluğu", status: "Düşük/Yüksek", desc: `%${keywordDensity}` });
      }

      data.seoAnalytics = {
        score: Math.max(seoScore, 30),
        wordCount,
        keywordDensity,
        checks: seoChecks
      };

      try {
        const rawImageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(data.imagePrompt)}?width=1200&height=630&nologo=true`;
        const imageRes = await fetch(rawImageUrl);
        const inputBuffer = Buffer.from(await imageRes.arrayBuffer());

        const titleText = data.newTitle || "";
        const words = titleText.split(' ');
        let lines = [];
        let currentLine = '';
        words.forEach(word => {
          if ((currentLine + ' ' + word).trim().length > 30) {
            lines.push(currentLine.trim());
            currentLine = word;
          } else {
            currentLine += (currentLine ? ' ' : '') + word;
          }
        });
        if (currentLine) lines.push(currentLine.trim());
        const startY = lines.length === 1 ? 320 : (lines.length === 2 ? 300 : 280);

        const svgOverlay = `
          <svg width="1200" height="630">
            <style>
              .title { fill: white; font-size: 46px; font-weight: 900; font-family: Arial, sans-serif; text-anchor: middle; }
              .badge { fill: #2563eb; }
              .badge-text { fill: white; font-size: 20px; font-weight: bold; font-family: Arial, sans-serif; letter-spacing: 2px; }
            </style>
            <rect width="1200" height="630" fill="rgba(0, 0, 0, 0.5)" />
            <rect x="460" y="160" width="280" height="45" rx="22.5" class="badge" />
            <text x="600" y="188" text-anchor="middle" class="badge-text">MATEMETRİK ÖZEL</text>
            <text x="600" y="${startY}" class="title">
              ${lines.map((line, idx) => `<tspan x="600" dy="${idx === 0 ? 0 : 55}">${line}</tspan>`).join('')}
            </text>
          </svg>
        `;

        const compositeBuffer = await sharp(inputBuffer)
          .resize(1200, 630)
          .composite([{ input: Buffer.from(svgOverlay), top: 0, left: 0 }])
          .jpeg({ quality: 90 })
          .toBuffer();

        data.bakedImage = `data:image/jpeg;base64,${compositeBuffer.toString('base64')}`;
      } catch (e) {
        data.bakedImage = `https://image.pollinations.ai/prompt/${encodeURIComponent(data.imagePrompt)}?width=1200&height=630&nologo=true`;
      }

      processedResults.push({ ...data, originalTopic: currentTopic, id: Date.now() + Math.random() });
    }

    let responsePayload = mode === 'bulk' ? processedResults : processedResults[0];

    if (mode === 'bulk') {
      let xmlItems = processedResults.map((item, idx) => `
        <item>
          <title><![CDATA[${item.newTitle}]]></title>
          <link>https://matemetrik.com/${item.slug}</link>
          <pubDate>${new Date().toUTCString()}</pubDate>
          <dc:creator><![CDATA[admin]]></dc:creator>
          <guid isPermaLink="false">https://matemetrik.com/?p=${1000 + idx}</guid>
          <description></description>
          <content:encoded><![CDATA[${item.blogPost}]]></content:encoded>
          <excerpt:encoded><![CDATA[${item.metaDescription}]]></excerpt:encoded>
          <wp:post_id>${1000 + idx}</wp:post_id>
          <wp:post_date><![CDATA[${new Date().toISOString().slice(0, 19).replace('T', ' ')}]]></wp:post_date>
          <wp:post_status><![CDATA[draft]]></wp:post_status>
          <wp:post_type><![CDATA[post]]></wp:post_type>
          <wp:post_name><![CDATA[${item.slug}]]></wp:post_name>
          ${item.tags ? item.tags.map(t => `<category domain="post_tag" nicename="${t}"><![CDATA[${t}]]></category>`).join('') : ''}
        </item>
      `).join('');

      let fullWxrXml = `<?xml version="1.0" encoding="UTF-8" ?>
      <rss version="2.0"
        xmlns:excerpt="http://wordpress.org/export/1.2/excerpt/"
        xmlns:content="http://purl.org/rss/1.0/modules/content/"
        xmlns:wfw="http://wellformedweb.org/CommentAPI/"
        xmlns:dc="http://purl.org/dc/elements/1.1/"
        xmlns:wp="http://wordpress.org/export/1.2/"
      >
      <channel>
        <title>Matemetrik Pro Stüdyo</title>
        <link>https://matemetrik.com</link>
        <description>Yapay Zeka Destekli Toplu İçerik Havuzu</description>
        <pubDate>${new Date().toUTCString()}</pubDate>
        <language>tr</language>
        <wp:wxr_version>1.2</wp:wxr_version>
        <wp:base_site_url>https://matemetrik.com</wp:base_site_url>
        <wp:base_blog_url>https://matemetrik.com</wp:base_blog_url>
        ${xmlItems}
      </channel>
      </rss>`;

      responsePayload = {
        items: processedResults,
        wordpressXml: fullWxrXml
      };
    }

    return new Response(JSON.stringify(responsePayload), { status: 200, headers: { 'Content-Type': 'application/json' } });
    
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}