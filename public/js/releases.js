const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';
let releaseData = [];

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('loadReleasesBtn').addEventListener('click', fetchReleases);
  document.getElementById('hasTheaterDate').addEventListener('change', renderList);
  document.getElementById('releasedTheaters').addEventListener('change', renderList);
  document.getElementById('hasDigitalDate').addEventListener('change', renderList);
  document.getElementById('releasedDigital').addEventListener('change', renderList);
  document.getElementById('sortOrder').addEventListener('change', renderList);
});

async function fetchReleases() {
  const username = localStorage.getItem('lboxd_username');
  if (!username) return alert('Primero carga una watchlist en la página principal');

  const savedData = localStorage.getItem(`watchlist_data_${username}`);
  if (!savedData) return alert('No hay datos guardados de la watchlist');

  const movies = JSON.parse(savedData);
  document.getElementById('statusMessage').innerText = 'Obteniendo fechas de estreno...';

  const today = new Date().toISOString().split('T')[0];
  const uniqueMoviesMap = new Map();

  // Procesamiento concurrente en bloques de 15 peticiones
  const chunkSize = 15;
  for (let i = 0; i < movies.length; i += chunkSize) {
    const chunk = movies.slice(i, i + chunkSize);
    document.getElementById('statusMessage').innerText = `Procesando fechas (${i + 1} de ${movies.length})...`;

    await Promise.all(
      chunk.map(async (m) => {
        if (uniqueMoviesMap.has(m.tmdb_id)) return;

        try {
          const res = await fetch(`/api/tmdb?endpoint=release_dates&tmdb_id=${m.tmdb_id}`);
          if (!res.ok) return;

          const data = await res.json();
          let earliestTheater = null;
          let earliestDigital = null;

          if (data.results) {
            data.results.forEach(country => {
              // Estrenos en Cine (AR, tipo 3)
              if (country.iso_3166_1 === 'AR') {
                country.release_dates.forEach(rd => {
                  if (rd.type === 3 && rd.release_date) {
                    const dateStr = rd.release_date.split('T')[0];
                    if (!earliestTheater || dateStr < earliestTheater) {
                      earliestTheater = dateStr;
                    }
                  }
                });
              }

              // Estrenos en Digital (todos los países, tipos 4, 5, 6)
              country.release_dates.forEach(rd => {
                if ([4, 5, 6].includes(rd.type) && rd.release_date) {
                  const dateStr = rd.release_date.split('T')[0];
                  if (!earliestDigital || dateStr < earliestDigital) {
                    earliestDigital = dateStr;
                  }
                }
              });
            });
          }

          uniqueMoviesMap.set(m.tmdb_id, {
            tmdb_id: m.tmdb_id,
            title: m.title,
            poster_path: m.poster_path,
            theaterDate: earliestTheater,
            digitalDate: earliestDigital,
            hasTheater: Boolean(earliestTheater),
            hasDigital: Boolean(earliestDigital),
            isReleasedTheater: Boolean(earliestTheater && earliestTheater <= today),
            isReleasedDigital: Boolean(earliestDigital && earliestDigital <= today)
          });
        } catch (e) {
          // Continuar con el siguiente elemento en caso de fallo puntual
        }
      })
    );
  }

  releaseData = Array.from(uniqueMoviesMap.values());
  document.getElementById('statusMessage').innerText = '';
  renderList();
}

function renderList() {
  const container = document.getElementById('releasesList');
  container.innerHTML = '';

  const filterHasTheater = document.getElementById('hasTheaterDate').checked;
  const filterIsReleasedTheater = document.getElementById('releasedTheaters').checked;
  const filterHasDigital = document.getElementById('hasDigitalDate').checked;
  const filterIsReleasedDigital = document.getElementById('releasedDigital').checked;
  const sortOrder = document.getElementById('sortOrder').value;

  let filtered = releaseData.filter(m => {
    if (filterHasTheater && !m.hasTheater) return false;
    if (filterIsReleasedTheater && !m.isReleasedTheater) return false;
    if (filterHasDigital && !m.hasDigital) return false;
    if (filterIsReleasedDigital && !m.isReleasedDigital) return false;
    return true;
  });

  filtered.sort((a, b) => {
    const dA_theater = a.theaterDate || '9999-99-99';
    const dB_theater = b.theaterDate || '9999-99-99';
    const dA_digital = a.digitalDate || '9999-99-99';
    const dB_digital = b.digitalDate || '9999-99-99';

    if (sortOrder === 'theater_asc') return dA_theater.localeCompare(dB_theater);
    if (sortOrder === 'theater_desc') return dB_theater.localeCompare(dA_theater);
    if (sortOrder === 'digital_asc') return dA_digital.localeCompare(dB_digital);
    if (sortOrder === 'digital_desc') return dB_digital.localeCompare(dA_digital);
  });

  filtered.forEach(m => {
    const card = document.createElement('div');
    card.className = 'movie-card';
    card.innerHTML = `
      <img class="poster" src="${TMDB_IMAGE_BASE}${m.poster_path}" alt="${m.title}">
      <div class="movie-info">
        <h4>${m.title}</h4>
        <p>Cine: ${m.theaterDate || 'Sin fecha'}</p>
        <p>Digital: ${m.digitalDate || 'Sin fecha'}</p>
      </div>
    `;
    container.appendChild(card);
  });
}