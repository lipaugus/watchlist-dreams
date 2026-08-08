const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo no permitido' });
  }

  const { slugs } = req.body;
  if (!slugs || !Array.isArray(slugs)) {
    return res.status(400).json({ error: 'Lista de slugs requerida' });
  }

  const filePath = path.join(process.cwd(), 'data', 'lboxd_tmdb_ids.json');
  let localCache = [];

  if (fs.existsSync(filePath)) {
    try {
      const fileData = fs.readFileSync(filePath, 'utf8');
      localCache = JSON.parse(fileData);
    } catch (e) {
      localCache = [];
    }
  }

  const results = [];
  const updatedCache = [...localCache];

  for (const slug of slugs) {
    const cached = updatedCache.find((item) => item.lboxd_query === slug);

    if (cached) {
      results.push(cached);
    } else {
      try {
        const url = `https://letterboxd.com/film/${slug}/`;
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });

        if (response.ok) {
          const html = await response.text();
          const $ = cheerio.load(html);
          
          let tmdbId = $('body').attr('data-tmdb-id') || $('[data-tmdb-id]').attr('data-tmdb-id');

          if (!tmdbId) {
            const match = html.match(/data-tmdb-id="(\d+)"/);
            if (match) tmdbId = match[1];
          }

          if (tmdbId) {
            const newItem = { lboxd_query: slug, tmdb_id: parseInt(tmdbId, 10) };
            results.push(newItem);
            updatedCache.push(newItem);
          }
        }
      } catch (err) {
        // Ignorar fallo puntual
      }
      // Demora de 1.5 segundos entre scraping de peliculas
      await sleep(1500);
    }
  }

  // Intentar guardar en disco local si se ejecuta en desarrollo
  try {
    fs.writeFileSync(filePath, JSON.stringify(updatedCache, null, 2));
  } catch (e) {
    // En entorno serverless de vercel la escritura directa en disco puede ser omitida
  }

  return res.status(200).json({ mapping: results });
};