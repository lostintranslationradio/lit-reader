exports.handler = async function () {
  const SUPABASE_URL = 'https://urozuwaidryhduquvtzi.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_tHobcgdhTkhP18yvEdg79Q_ItYxDVuw';
  const SITE_URL = 'https://lostintranslationradio.com';

  let songs = [];
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/songs?select=id&status=eq.published`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
    );
    if (res.ok) songs = await res.json();
  } catch (err) {
    // If Supabase is unreachable, fall back to just the static pages below
    // rather than returning a broken sitemap.
  }

  const urls = [
    { loc: `${SITE_URL}/`, changefreq: 'weekly', priority: '1.0' },
    { loc: `${SITE_URL}/how-to-use.html`, changefreq: 'monthly', priority: '0.5' },
    { loc: `${SITE_URL}/about`, changefreq: 'monthly', priority: '0.5' },
    ...songs.map((s) => ({
      loc: `${SITE_URL}/reader.html?song=${encodeURIComponent(s.id)}`,
      changefreq: 'monthly',
      priority: '0.8'
    }))
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) =>
      `  <url>\n    <loc>${u.loc}</loc>\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`
  )
  .join('\n')}
</urlset>`;

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
    body: xml
  };
};
