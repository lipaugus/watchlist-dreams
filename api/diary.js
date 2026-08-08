const fs = require('fs');
const path = require('path');

function cleanString(str) {
  if (!str) return '';
  return str
    .replace(/Ã©/g, 'é')
    .replace(/Ã¡/g, 'á')
    .replace(/Ã­/g, 'í')
    .replace(/Ã³/g, 'ó')
    .replace(/Ãº/g, 'ú')
    .replace(/Ã±/g, 'ñ')
    .replace(/Ã/g, 'À')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

module.exports = async (req, res) => {
  try {
    const csvPath = path.join(process.cwd(), 'data', 'diary.csv');
    const cachePath = path.join(process.cwd(), 'data', 'lboxd_tmdb_ids.json');

    if (!fs.existsSync(csvPath)) {
      return res.status(404).json({ error: 'Archivo diary.csv no encontrado en carpeta data' });
    }

    let tmdbCache = [];
    if (fs.existsSync(cachePath)) {
      try {
        tmdbCache = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
      } catch (e) {
        tmdbCache = [];
      }
    }

    const csvContent = fs.readFileSync(csvPath, 'utf8');
    const lines = csvContent.split(/\r?\n/);
    if (lines.length <= 1) {
      return res.status(200).json({ diary: [] });
    }

    const header = lines[0].split(/\t|,/);
    const nameIdx = header.findIndex(h => h.trim().toLowerCase() === 'name');
    const yearIdx = header.findIndex(h => h.trim().toLowerCase() === 'year');
    const ratingIdx = header.findIndex(h => h.trim().toLowerCase() === 'rating');

    const diaryEntries = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const cols = line.split(/\t/);
      const name = cols[nameIdx] ? cols[nameIdx].trim() : '';
      const year = cols[yearIdx] ? cols[yearIdx].trim() : '';
      const rawRating = cols[ratingIdx] ? parseFloat(cols[ratingIdx].trim()) : 0;

      if (!name) continue;

      const cleanCsvName = cleanString(name);
      
      const match = tmdbCache.find(item => {
        const itemTitle = item.lboxd_title || '';
        const itemQuery = item.film_query || item.lboxd_query || '';
        const cleanItemTitle = cleanString(itemTitle);
        const cleanQuery = cleanString(itemQuery);

        const nameMatch = cleanItemTitle.includes(cleanCsvName) || cleanQuery.includes(cleanCsvName);
        const yearMatch = year ? itemTitle.includes(year) || itemQuery.includes(year) : true;

        return nameMatch && yearMatch;
      });

      if (match) {
        diaryEntries.push({
          name: name,
          year: year,
          rating: isNaN(rawRating) ? 0 : rawRating,
          tmdb_id: match.tmdb_id,
          slug: match.film_query || match.lboxd_query
        });
      }
    }

    return res.status(200).json({ diary: diaryEntries });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};