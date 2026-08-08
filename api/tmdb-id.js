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

  // Leer JSON estatico empaquetado en el despliegue
  const filePath = path.join(process.cwd(), 'data', 'lboxd_tmdb_ids.json');
  let staticCache = [];

  if (fs.existsSync(filePath)) {
    try {
      const fileData = fs.readFileSync(filePath, 'utf8');
      staticCache = JSON.parse(fileData);
    } catch (e) {
      staticCache = [];
    }
  }

  const results = [];

  for (const slug of slugs) {
    const cached = staticCache.find((item) => item.lboxd_query === slug);

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
            results.push({ lboxd_query: slug, tmdb_id: parseInt(tmdbId, 10) });
          }
        }
      } catch (err) {
        // Continuar con el siguiente slug en caso de error
      }
      // Pausa de 800ms entre raspados individuales
      await sleep(800);
    }
  }

  return res.status(200).json({ mapping: results });
};