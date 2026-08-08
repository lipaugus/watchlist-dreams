module.exports = async (req, res) => {
  const { endpoint, tmdb_id } = req.query;
  const token = process.env.TMDB_TOKEN;

  if (!token) {
    return res.status(500).json({ error: 'TMDB_TOKEN no configurado en entorno' });
  }

  let targetUrl = '';

  if (endpoint === 'providers') {
    targetUrl = `https://api.themoviedb.org/3/movie/${tmdb_id}/watch/providers`;
  } else if (endpoint === 'details') {
    targetUrl = `https://api.themoviedb.org/3/movie/${tmdb_id}?language=en-US`;
  } else if (endpoint === 'release_dates') {
    targetUrl = `https://api.themoviedb.org/3/movie/${tmdb_id}/release_dates`;
  } else {
    return res.status(400).json({ error: 'Endpoint no valido' });
  }

  try {
    const response = await fetch(targetUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json;charset=utf-8'
      }
    });

    const data = await response.json();
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};