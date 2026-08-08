const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';
let releaseData = [];

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('loadReleasesBtn').addEventListener('click', fetchReleases);
  document.getElementById('releasedTheaters').addEventListener('change', renderList);
  document.getElementById('releasedDigital').addEventListener('change', renderList);
  document.getElementById('sortOrder').addEventListener('change', renderList);
});

async function fetchReleases() {
  const username = localStorage.getItem('lboxd_username');
  if (!username) return alert('Primero carga una watchlist en la pagina principal');

  const savedData = localStorage.getItem(`watchlist_data_${username}`);
  if (!savedData) return alert('No hay datos guardados de la watchlist');

  const movies = JSON.parse(savedData);
  document.getElementById('statusMessage').innerText = 'Obteniendo fechas de estreno...';

  releaseData = [];
  const today = new Date().toISOString().split('T')[0];

  for (const m of movies) {
    const res = await fetch(`/api/tmdb?endpoint=release_dates&tmdb_id=${m.tmdb_id}`);
    const data = await res.json();

    let theaterDate = null;
    let digitalDate = null;

    if (data.results) {
      data.results.forEach(country => {
        // Cines solo en AR (Type 3)
        if (country.iso_3166_1 === 'AR') {
          country.release_dates.forEach(rd => {
            if (rd.type === 3) {
              const dateStr = rd.release_date.split('T')[0];
              if (!theaterDate || dateStr < theaterDate) theaterDate = dateStr;
            }
          });
        }

        // Digital en cualquier ISO (Types 4, 5, 6)
        country.release_dates.forEach(rd => {
          if ([4, 5, 6].includes(rd.type)) {
            const dateStr = rd.release_date.split('T')[0];
            if (!digitalDate || dateStr < digitalDate) digitalDate = dateStr;
          }
        });
      });
    }

    releaseData.push({
      title: m.title,
      poster_path: m.poster_path,
      theaterDate: theaterDate,
      digitalDate: digitalDate,
      isReleasedTheater: theaterDate && theaterDate <= today,
      isReleasedDigital: digitalDate && digitalDate <= today
    });
  }

  document.getElementById('statusMessage').innerText = '';
  renderList();
}

function renderList() {
  const container = document.getElementById('releasesList');
  container.innerHTML = '';

  const filterTheater = document.getElementById('releasedTheaters').checked;
  const filterDigital = document.getElementById('releasedDigital').checked;
  const sortOrder = document.getElementById('sortOrder').value;

  let filtered = releaseData.filter(m => {
    if (filterTheater && !m.isReleasedTheater) return false;
    if (filterDigital && !m.isReleasedDigital) return false;
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
        <p><small>Cine AR: ${m.theaterDate || 'Sin fecha'}</small></p>
        <p><small>Digital: ${m.digitalDate || 'Sin fecha'}</small></p>
      </div>
    `;
    container.appendChild(card);
  });
}