const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';
let moviesData = [];
let selectedProviders = [];

document.addEventListener('DOMContentLoaded', () => {
  const savedUsername = localStorage.getItem('lboxd_username');
  if (savedUsername) {
    document.getElementById('usernameInput').value = savedUsername;
    const cacheKey = `watchlist_data_${savedUsername}`;
    const savedData = localStorage.getItem(cacheKey);
    
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        // Si los datos guardados son de la version anterior (sin runtime), limpiamos cache
        if (parsed.length > 0 && parsed[0].runtime === undefined) {
          localStorage.removeItem(cacheKey);
        } else {
          moviesData = parsed;
          renderProvidersFilter();
          renderMovies();
        }
      } catch (e) {
        localStorage.removeItem(cacheKey);
      }
    }
  }

  document.getElementById('loadBtn').addEventListener('click', () => processWatchlist(false));
  document.getElementById('refreshBtn').addEventListener('click', () => processWatchlist(true));

  const minSlider = document.getElementById('minRuntime');
  const maxSlider = document.getElementById('maxRuntime');
  minSlider.addEventListener('input', handleRuntimeChange);
  maxSlider.addEventListener('input', handleRuntimeChange);
});

function handleRuntimeChange() {
  const minSlider = document.getElementById('minRuntime');
  const maxSlider = document.getElementById('maxRuntime');
  
  let minVal = parseInt(minSlider.value, 10);
  let maxVal = parseInt(maxSlider.value, 10);

  if (minVal > maxVal) {
    minVal = maxVal;
    minSlider.value = minVal;
  }

  const maxLabel = maxVal === 240 ? '240+ min' : `${maxVal} min`;
  document.getElementById('runtimeDisplay').innerText = `${minVal} min - ${maxLabel}`;
  renderMovies();
}

function getLocalMappings() {
  const cached = localStorage.getItem('lboxd_tmdb_mappings');
  return cached ? JSON.parse(cached) : {};
}

function saveLocalMappings(newMappings) {
  const current = getLocalMappings();
  const updated = { ...current, ...newMappings };
  localStorage.setItem('lboxd_tmdb_mappings', JSON.stringify(updated));
}

async function processWatchlist(forceRefresh) {
  const username = document.getElementById('usernameInput').value.trim();
  if (!username) return alert('Ingresa un usuario');

  localStorage.setItem('lboxd_username', username);
  const cacheKey = `watchlist_data_${username}`;

  if (!forceRefresh) {
    const savedData = localStorage.getItem(cacheKey);
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        if (parsed.length > 0 && parsed[0].runtime !== undefined) {
          moviesData = parsed;
          renderProvidersFilter();
          renderMovies();
          return;
        }
      } catch (e) {
        localStorage.removeItem(cacheKey);
      }
    }
  }

  updateStatus('Obteniendo watchlist de Letterboxd...');
  try {
    const resWl = await fetch(`/api/watchlist?username=${username}`);
    if (!resWl.ok) throw new Error(`Error en watchlist (${resWl.status})`);
    
    const wlData = await resWl.json();
    const rawSlugs = wlData.watchlist || [];
    const slugs = [...new Set(rawSlugs)];

    if (slugs.length === 0) {
      updateStatus('La watchlist está vacía o el usuario no existe.');
      return;
    }

    const localMappings = getLocalMappings();
    const missingSlugs = slugs.filter(slug => !localMappings[slug]);

    if (missingSlugs.length > 0) {
      const batchSize = 5;
      for (let i = 0; i < missingSlugs.length; i += batchSize) {
        const batch = missingSlugs.slice(i, i + batchSize);
        updateStatus(`Mapeando TMDB IDs (${i + 1} de ${missingSlugs.length})...`);

        const resMap = await fetch('/api/tmdb-id', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slugs: batch })
        });

        if (!resMap.ok) throw new Error(`Error en mapeo TMDB (${resMap.status})`);

        const mapData = await resMap.json();
        const batchResults = {};

        (mapData.mapping || []).forEach(item => {
          const key = item.lboxd_query || item.film_query;
          if (key) batchResults[key] = item.tmdb_id;
        });

        saveLocalMappings(batchResults);
      }
    }

    const updatedMappings = getLocalMappings();
    const mappedItems = slugs
      .filter(slug => updatedMappings[slug])
      .map(slug => ({ lboxd_query: slug, tmdb_id: updatedMappings[slug] }));

    updateStatus('Cargando detalles de TMDB y streaming...');
    
    const fetchedMoviesMap = new Map();
    const tmdbBatchSize = 5;

    for (let i = 0; i < mappedItems.length; i += tmdbBatchSize) {
      const chunk = mappedItems.slice(i, i + tmdbBatchSize);
      updateStatus(`Cargando TMDB info (${i + 1} de ${mappedItems.length})...`);

      const chunkResults = await Promise.all(
        chunk.map(async (item) => {
          try {
            const [detailsRes, provRes] = await Promise.all([
              fetch(`/api/tmdb?endpoint=details&tmdb_id=${item.tmdb_id}`),
              fetch(`/api/tmdb?endpoint=providers&tmdb_id=${item.tmdb_id}`)
            ]);

            if (!detailsRes.ok || !provRes.ok) return null;

            const details = await detailsRes.json();
            const provData = await provRes.json();

            const arProviders = provData.results && provData.results.AR && provData.results.AR.flatrate
              ? provData.results.AR.flatrate
              : [];

            arProviders.sort((a, b) => a.display_priority - b.display_priority);

            return {
              slug: item.lboxd_query,
              tmdb_id: item.tmdb_id,
              title: details.title,
              poster_path: details.poster_path,
              runtime: typeof details.runtime === 'number' ? details.runtime : 0,
              genres: details.genres || [],
              providers: arProviders
            };
          } catch (e) {
            return null;
          }
        })
      );

      chunkResults.forEach(res => {
        if (res && !fetchedMoviesMap.has(res.tmdb_id)) {
          fetchedMoviesMap.set(res.tmdb_id, res);
        }
      });
    }

    moviesData = Array.from(fetchedMoviesMap.values());
    localStorage.setItem(cacheKey, JSON.stringify(moviesData));
    updateStatus('');
    renderProvidersFilter();
    renderMovies();

  } catch (err) {
    updateStatus(`Error: ${err.message}`);
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
    btn.title = p.provider_name;
    btn.setAttribute('aria-label', p.provider_name);
    btn.innerHTML = `<img src="${TMDB_IMAGE_BASE}${p.logo_path}" alt="${p.provider_name}">`;
    
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

  const minRuntime = parseInt(document.getElementById('minRuntime').value, 10);
  const maxRuntime = parseInt(document.getElementById('maxRuntime').value, 10);

  moviesData.forEach(m => {
    const hasProvider = selectedProviders.length === 0 || 
      m.providers.some(p => selectedProviders.includes(p.provider_id));

    // Evaluacion segura del runtime frente a undefined/null
    const runtimeVal = typeof m.runtime === 'number' ? m.runtime : 0;
    const matchRuntime = runtimeVal >= minRuntime && (maxRuntime === 240 || runtimeVal <= maxRuntime);

    if (hasProvider && matchRuntime) {
      const card = document.createElement('div');
      card.className = 'movie-card';

      let providersHtml = m.providers.map(p => 
        `<img src="${TMDB_IMAGE_BASE}${p.logo_path}" title="${p.provider_name}" alt="${p.provider_name}">`
      ).join('');

      card.innerHTML = `
        <img class="poster" src="${TMDB_IMAGE_BASE}${m.poster_path}" alt="${m.title}">
        <div class="movie-info">
          <h4>${m.title}</h4>
          <p><small>${runtimeVal ? runtimeVal + ' min' : 'S/D'}</small></p>
          <div class="providers-list">${providersHtml}</div>
        </div>
      `;
      grid.appendChild(card);
    }
  });
}