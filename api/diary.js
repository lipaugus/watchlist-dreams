const cheerio = require('cheerio');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

module.exports = async (req, res) => {
  const username = 'lucasv2';
  const diaryEntries = [];
  let page = 1;
  let hasMore = true;

  try {
    while (hasMore) {
      const url = `https://letterboxd.com/${username}/films/diary/page/${page}/`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      if (response.status === 404) {
        hasMore = false;
        break;
      }

      const html = await response.text();
      const $ = cheerio.load(html);
      const rows = $('tr.diary-entry-row');

      if (rows.length === 0) {
        hasMore = false;
        break;
      }

      rows.each((_, el) => {
        const posterDiv = $(el).find('.react-component');
        const slug = posterDiv.attr('data-item-slug');

        const ratingSpan = $(el).find('.rating');
        let rating = 0;

        if (ratingSpan.length > 0) {
          const classList = ratingSpan.attr('class').split(' ');
          const ratedClass = classList.find((c) => c.startsWith('rated-'));
          if (ratedClass) {
            const val = parseInt(ratedClass.replace('rated-', ''), 10);
            rating = val / 2; // Conversion a escala de 1 a 5 estrellas
          }
        }

        if (slug) {
          diaryEntries.push({ lboxd_query: slug, lucas_rating: rating });
        }
      });

      page++;
      await sleep(1200);
    }

    return res.status(200).json({ diary: diaryEntries });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};