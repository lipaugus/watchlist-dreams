const cheerio = require('cheerio');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

module.exports = async (req, res) => {
  const { username } = req.query;

  if (!username) {
    return res.status(400).json({ error: 'Nombre de usuario requerido' });
  }

  const lboxdQueries = [];
  let page = 1;
  let hasMore = true;

  try {
    while (hasMore) {
      const url = `https://letterboxd.com/${username}/watchlist/page/${page}/`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      if (response.status === 404) {
        hasMore = false;
        break;
      }

      if (!response.ok) {
        return res.status(response.status).json({ error: 'Error al consultar Letterboxd' });
      }

      const html = await response.text();
      const $ = cheerio.load(html);
      const items = $('.griditem .react-component');

      if (items.length === 0) {
        hasMore = false;
        break;
      }

      items.each((_, el) => {
        const slug = $(el).attr('data-item-slug');
        if (slug && !lboxdQueries.includes(slug)) {
          lboxdQueries.push(slug);
        }
      });

      page++;
      // Demora de 1.2 segundos por pagina para evitar bloqueos
      await sleep(1200);
    }

    return res.status(200).json({ watchlist: lboxdQueries });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};