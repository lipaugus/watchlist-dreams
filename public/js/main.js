const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';
let moviesData = [];
let selectedProviders = [];

document.addEventListener('DOMContentLoaded', () => {
  const savedUsername = localStorage.getItem('lboxd_username');
  if (savedUsername) {
    document.getElementById('usernameInput').value = savedUsername;
    const savedData = localStorage.getItem(`watchlist_data_${savedUsername}`);
    if (savedData) {
      moviesData = JSON.parse(savedData);
      renderProvidersFilter();
      renderMovies();
    }
  }

  document.getElementById('loadBtn').addEventListener('click', () => processWatchlist(false));
  document.getElementById('refreshBtn').addEventListener('click', () => processWatchlist(true));
});

async function processWatchlist(forceRefresh) {
  const username = document.getElementById('usernameInput').value.trim();
  if (!username) return alert('Ingresa un usuario');

  localStorage.setItem('lboxd_username', username);
  const cacheKey = `watchlist_data_${username}`;

  if (!forceRefresh) {
    const savedData = localStorage.getItem(cacheKey);
    if (savedData) {
      moviesData = JSON.parse(savedData);
      renderProvidersFilter();
      renderMovies();
      return;
    }
  }

  updateStatus('Obteniendo watchlist de Letterboxd...');
  try {
    const resWl = await fetch(`/api/watchlist?username=${username}`);
    const wlData = await resWl.json();
    const slugs = wlData.watchlist;

    updateStatus('Mapeando peliculas con TMDB...');
    const resMap = await fetch('/api/tmdb-id', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slugs })
    });
    const mapData = await resMap.json();

    updateStatus('Obteniendo detalles y servicios de streaming...');
    moviesData = [];

    for (const item of mapData.mapping) {
      const detailsRes = await fetch(`/api/tmdb?endpoint=details&tmdb_id=${item.tmdb_id}`);
      const details = await detailsRes.json();

      const provRes = await fetch(`/api/tmdb?endpoint=providers&tmdb_id=${item.tmdb_id}`);
      const provData = await provRes.json();

      const arProviders = provData.results && provData.results.AR && provData.results.AR.flatrate
        ? provData.results.AR.flatrate
        : [];

      // Ordenar por display_priority
      arProviders.sort((a, b) => a.display_priority - b.display_priority);

      moviesData.push({
        slug: item.lboxd_query,
        tmdb_id: item.tmdb_id,
        title: details.title,
        poster_path: details.poster_path,
        genres: details.genres || [],
        providers: arProviders
      });
    }

    localStorage.setItem(cacheKey, JSON.stringify(moviesData));
    updateStatus('');
    renderProvidersFilter();
    renderMovies();
  } catch (err) {
    updateStatus('Error al procesar los datos');
  }
}

function updateStatus(msg) {
  document.getElementById('statusMessage').innerText = msg;
}

function renderProvidersFilter() {
  const container = document.getElementById('streamingFilters');
  container.innerHTML = '';

  const providersMap = new Map();
  moviesData.forEach(m => {
    m.providers.forEach(p => {
      if (!providersMap.has(p.provider_id)) {
        providersMap.set(p.provider_id, p);
      }
    });
  });

  providersMap.forEach((p) => {
    const btn = document.createElement('button');
    btn.className = 'provider-btn';
    btn.innerHTML = `<img src="${TMDB_IMAGE_BASE}${p.logo_path}" alt="${p.provider_name}"> ${p.provider_name}`;
    btn.addEventListener('click', () => {
      if (selectedProviders.includes(p.provider_id)) {
        selectedProviders = selectedProviders.filter(id => id !== p.provider_id);
        btn.classList.remove('active');
      } else {
        selectedProviders.push(p.provider_id);
        btn.classList.add('active');
      }
      renderMovies();
    });
    container.appendChild(btn);
  });
}

function renderMovies() {
  const grid = document.getElementById('movieGrid');
  grid.innerHTML = '';

  moviesData.forEach(m => {
    const hasProvider = selectedProviders.length === 0 || 
      m.providers.some(p => selectedProviders.includes(p.provider_id));

    if (hasProvider) {
      const card = document.createElement('div');
      card.className = 'movie-card';

      let providersHtml = m.providers.map(p => 
        `<img src="${TMDB_IMAGE_BASE}${p.logo_path}" title="${p.provider_name}">`
      ).join('');

      card.innerHTML = `
        <img class="poster" src="${TMDB_IMAGE_BASE}${m.poster_path}" alt="${m.title}">
        <div class="movie-info">
          <h4>${m.title}</h4>
          <div class="providers-list">${providersHtml}</div>
        </div>
      `;
      grid.appendChild(card);
    }
  });
}