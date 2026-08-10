const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';
let lucasMovies = [];
let selectedProviders = [];

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('loadLucasBtn').addEventListener('click', loadLucasData);
  document.getElementById('genreFilter').addEventListener('change', renderMovies);
  document.getElementById('decadeFilter').addEventListener('change', renderMovies);
  document.getElementById('sortFilter').addEventListener('change', renderMovies);

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

async function loadLucasData() {
  document.getElementById('statusMessage').innerText = 'Cargando diario de Lucas desde CSV...';
  try {
    const diaryRes = await fetch('/api/diary');
    const diaryData = await diaryRes.json();
    const entries = diaryData.diary || [];

    const moviesMap = new Map();
    // Procesamiento optimizado en lotes de 5 para movil
    const chunkSize = 5;

    for (let i = 0; i < entries.length; i += chunkSize) {
      const chunk = entries.slice(i, i + chunkSize);
      document.getElementById('statusMessage').innerText = `Obteniendo datos de TMDB (${i + 1} de ${entries.length})...`;

      await Promise.all(
        chunk.map(async (entry) => {
          if (moviesMap.has(entry.tmdb_id)) return;

          try {
            const [detailsRes, provRes] = await Promise.all([
              fetch(`/api/tmdb?endpoint=details&tmdb_id=${entry.tmdb_id}`),
              fetch(`/api/tmdb?endpoint=providers&tmdb_id=${entry.tmdb_id}`)
            ]);

            if (!detailsRes.ok || !provRes.ok) return;

            const details = await detailsRes.json();
            const provData = await provRes.json();

            const arProviders = provData.results && provData.results.AR && provData.results.AR.flatrate
              ? provData.results.AR.flatrate
              : [];

            moviesMap.set(entry.tmdb_id, {
              title: details.title,
              poster_path: details.poster_path,
              runtime: details.runtime || 0,
              lucas_rating: entry.rating,
              popularity: details.popularity,
              release_date: details.release_date,
              genres: details.genres || [],
              providers: arProviders
            });
          } catch (e) {
            // Continuar si falla un elemento puntual
          }
        })
      );
    }

    lucasMovies = Array.from(moviesMap.values());
    document.getElementById('statusMessage').innerText = '';
    populateFilters();
    renderMovies();
  } catch (e) {
    document.getElementById('statusMessage').innerText = 'Error al cargar datos de Lucas';
  }
}

function populateFilters() {
  const genreSelect = document.getElementById('genreFilter');
  const decadeSelect = document.getElementById('decadeFilter');

  genreSelect.innerHTML = '<option value="">Todos los géneros</option>';
  decadeSelect.innerHTML = '<option value="">Todas las décadas</option>';

  const genresMap = new Map();
  const decadesSet = new Set();

  lucasMovies.forEach(m => {
    m.genres.forEach(g => genresMap.set(g.id, g.name));
    if (m.release_date) {
      const year = parseInt(m.release_date.substring(0, 4), 10);
      if (!isNaN(year)) {
        decadesSet.add(Math.floor(year / 10) * 10);
      }
    }
  });

  genresMap.forEach((name, id) => {
    const opt = document.createElement('option');
    opt.value = id;
    opt.innerText = name;
    genreSelect.appendChild(opt);
  });

  Array.from(decadesSet).sort((a, b) => b - a).forEach(d => {
    const opt = document.createElement('option');
    opt.value = d;
    opt.innerText = `${d}s`;
    decadeSelect.appendChild(opt);
  });

  renderProvidersFilter();
}

function renderProvidersFilter() {
  const container = document.getElementById('lucasStreamingFilters');
  container.innerHTML = '';
  const providersMap = new Map();

  lucasMovies.forEach(m => {
    m.providers.forEach(p => {
      if (!providersMap.has(p.provider_id)) providersMap.set(p.provider_id, p);
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
  const grid = document.getElementById('lucasMovieGrid');
  grid.innerHTML = '';

  const genreVal = document.getElementById('genreFilter').value;
  const decadeVal = document.getElementById('decadeFilter').value;
  const sortVal = document.getElementById('sortFilter').value;
  const minRuntime = parseInt(document.getElementById('minRuntime').value, 10);
  const maxRuntime = parseInt(document.getElementById('maxRuntime').value, 10);

  let filtered = lucasMovies.filter(m => {
    const matchGenre = !genreVal || m.genres.some(g => g.id === parseInt(genreVal, 10));

    let matchDecade = true;
    if (decadeVal && m.release_date) {
      const year = parseInt(m.release_date.substring(0, 4), 10);
      matchDecade = Math.floor(year / 10) * 10 === parseInt(decadeVal, 10);
    }

    const matchProvider = selectedProviders.length === 0 ||
      m.providers.some(p => selectedProviders.includes(p.provider_id));
    const runtimeVal = typeof m.runtime === 'number' ? m.runtime : 0;

    const matchRuntime = runtimeVal >= minRuntime && (maxRuntime === 240 || runtimeVal <= maxRuntime);
    return matchGenre && matchDecade && matchProvider && matchRuntime;
  });

  if (sortVal === 'rating_desc') {
    filtered.sort((a, b) => b.lucas_rating - a.lucas_rating);
  } else if (sortVal === 'tmdb_desc') {
    filtered.sort((a, b) => b.popularity - a.popularity);
  }

  filtered.forEach(m => {
    const card = document.createElement('div');
    card.className = 'movie-card';

    const ratingText = m.lucas_rating && m.lucas_rating > 0 ? `★ ${m.lucas_rating}` : '-';

    card.innerHTML = `
      <img class="poster" src="${TMDB_IMAGE_BASE}${m.poster_path}" alt="${m.title}">
      <div class="movie-info">
        <h4>${m.title}</h4>
        <p>Lucas: ${ratingText}</p>
        <p><small>${m.runtime ? m.runtime + ' min' : 'S/D'}</small></p>
      </div>
    `;
    grid.appendChild(card);
  });
}