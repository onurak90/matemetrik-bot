export async function POST(request) {
  try {
    const { items } = await request.json();

    if (!items || !Array.isArray(items) || items.length === 0) {
      return new Response(JSON.stringify({ error: 'Dışa aktarılacak makale seçilmedi.' }), { status: 400 });
    }

    // XML özel karakterlerini escape eden yardımcı fonksiyon
    const escapeXml = (str) => {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
    };

    let xmlItems = items.map((item, idx) => {
      const title = item.newTitle || 'Başlıksız Makale';
      const slug = item.slug || `makale-${idx}`;
      const description = item.metaDescription || '';
      const content = item.blogPost || '';

      return `
    <item>
      <title>${escapeXml(title)}</title>
      <link>https://matemetrik.com/${escapeXml(slug)}</link>
      <pubDate>${new Date().toUTCString()}</pubDate>
      <dc:creator><![CDATA[admin]]></dc:creator>
      <guid isPermaLink="false">https://matemetrik.com/?p=${3000 + idx}</guid>
      <description><![CDATA[${description}]]></description>
      <content:encoded><![CDATA[${content}]]></content:encoded>
      <excerpt:encoded><![CDATA[${description}]]></excerpt:encoded>
      <wp:post_id>${3000 + idx}</wp:post_id>
      <wp:post_date><![CDATA[${new Date().toISOString().slice(0, 19).replace('T', ' ')}]]></wp:post_date>
      <wp:post_status><![CDATA[draft]]></wp:post_status>
      <wp:post_type><![CDATA[post]]></wp:post_type>
      <wp:post_name><![CDATA[${escapeXml(slug)}]]></wp:post_name>
      ${item.tags ? item.tags.map(t => `<category domain="post_tag" nicename="${escapeXml(t)}"><![CDATA[${t}]]></category>`).join('') : ''}
    </item>`;
    }).join('');

    let fullWxrXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:excerpt="http://wordpress.org/export/1.2/excerpt/"
  xmlns:content="http://purl.org/rss/1.0/modules/content/"
  xmlns:wfw="http://wellformedweb.org/CommentAPI/"
  xmlns:dc="http://purl.org/dc/elements/1.1/"
  xmlns:wp="http://wordpress.org/export/1.2/"
>
<channel>
  <title>Matemetrik Pro Stüdyo - Seçilenler</title>
  <link>https://matemetrik.com</link>
  <description>Seçilen Makaleler WordPress XML Paketi</description>
  <pubDate>${new Date().toUTCString()}</pubDate>
  <language>tr</language>
  <wp:wxr_version>1.2</wp:wxr_version>
  <wp:base_site_url>https://matemetrik.com</wp:base_site_url>
  <wp:base_blog_url>https://matemetrik.com</wp:base_blog_url>
  ${xmlItems}
</channel>
</rss>`;

    return new Response(fullWxrXml.trim(), {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Content-Disposition': `attachment; filename="matemetrik-export-${Date.now()}.xml"`
      }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}