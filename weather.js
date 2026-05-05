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

async function fetchWeather(lat, lon, cityName) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code` +
    `&wind_speed_unit=kmh&timezone=auto`;

  const res  = await fetch(url);
  const data = await res.json();
  const c    = data.current;

  document.getElementById('city-name').textContent   = cityName;
  document.getElementById('weather-icon').textContent = weatherIcon(c.weather_code);
  document.getElementById('temperature').textContent  = `${Math.round(c.temperature_2m)}°C`;
  document.getElementById('description').textContent  = weatherDescription(c.weather_code);
  document.getElementById('extra-info').textContent   =
    `לחות: ${c.relative_humidity_2m}%  |  רוח: ${Math.round(c.wind_speed_10m)} קמ"ש`;

  weatherDisplay.classList.remove('hidden');
}

function weatherIcon(code) {
  if (code === 0)               return '☀️';
  if (code <= 2)                return '🌤️';
  if (code === 3)               return '☁️';
  if (code <= 49)               return '🌫️';
  if (code <= 67)               return '🌧️';
  if (code <= 77)               return '❄️';
  if (code <= 82)               return '🌦️';
  if (code <= 86)               return '🌨️';
  if (code >= 95)               return '⛈️';
  return '🌡️';
}

function weatherDescription(code) {
  if (code === 0)  return 'שמיים בהירים';
  if (code === 1)  return 'בעיקר בהיר';
  if (code === 2)  return 'מעונן חלקית';
  if (code === 3)  return 'מעונן';
  if (code <= 49)  return 'ערפל';
  if (code <= 55)  return 'טפטוף קל';
  if (code <= 57)  return 'טפטוף קפוא';
  if (code <= 65)  return 'גשם';
  if (code <= 67)  return 'גשם קפוא';
  if (code <= 77)  return 'שלג';
  if (code <= 82)  return 'מטר';
  if (code <= 86)  return 'מטר שלג';
  if (code === 95) return 'סופת רעמים';
  if (code <= 99)  return 'סופת רעמים עם ברד';
  return 'לא ידוע';
}

function showError(msg) {
  if (msg) {
    errorMsg.textContent = msg;
    errorMsg.classList.remove('hidden');
  } else {
    errorMsg.classList.add('hidden');
  }
}
