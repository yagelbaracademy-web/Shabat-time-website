const searchBtn   = document.getElementById('search-btn');
const cityInput   = document.getElementById('city-input');
const weatherDisplay = document.getElementById('weather-display');
const errorMsg    = document.getElementById('error-msg');

searchBtn.addEventListener('click', handleSearch);
cityInput.addEventListener('keydown', e => { if (e.key === 'Enter') handleSearch(); });

async function handleSearch() {
  const city = cityInput.value.trim();
  if (!city) return;

  showError('');
  weatherDisplay.classList.add('hidden');
  searchBtn.disabled = true;
  searchBtn.textContent = 'מחפש...';

  try {
    const { lat, lon, displayName } = await geocode(city);
    await fetchWeather(lat, lon, displayName);
  } catch (err) {
    showError(err.message);
  } finally {
    searchBtn.disabled = false;
    searchBtn.textContent = 'חפש';
  }
}

async function geocode(city) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=he&format=json`;
  const res  = await fetch(url);
  const data = await res.json();

  if (!data.results || data.results.length === 0) {
    throw new Error(`העיר "${city}" לא נמצאה`);
  }

  const r = data.results[0];
  return { lat: r.latitude, lon: r.longitude, displayName: r.name };
}
