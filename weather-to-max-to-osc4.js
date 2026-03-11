
const { Client } = require('node-osc');
require('dotenv').config();

const API_KEY = process.env.API_CODE;              // ta clé API
const CITY = 'toulouse';                          // ville
const OSC_IP = '127.0.0.1';                        // IP de la machine où tourne Max
const OSC_PORT = 7400;                             // port UDP dans Max (udpreceive 7400)
const REFRESH_EVERY_MS = 1 * 10 * 1000;            // intervalle (ici 1 min)
const MISSING_NUMBER = -9999;
const MISSING_STRING = '';

// --- Codes météo vers entiers ---
const CONDITION_CODES = {
  Clear:        0,
  Clouds:       1,
  Rain:         2,
  Drizzle:      3,
  Thunderstorm: 4,
  Snow:         5,
  Mist:         6,
  Fog:          7,
  Smoke:        8,
  Haze:         9,
  Dust:         10,
  Sand:         11,
  Ash:          12,
  Squall:       13,
  Tornado:      14
};

// --- Client OSC ---
const oscClient = new Client(OSC_IP, OSC_PORT);

// --- Utils ---
// Convertit un timestamp UTC (en secondes) + offset (en secondes)
// en heure locale float 0–24 (ex : 13.5 = 13h30)
function toLocalHourFloat(utcSeconds, timezoneOffsetSeconds) {
  const d = new Date((utcSeconds + timezoneOffsetSeconds) * 1000);
  const h = d.getUTCHours();
  const m = d.getUTCMinutes();
  const s = d.getUTCSeconds();
  return h + m / 60 + s / 3600;
}

function sendOscValue(address, value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    oscClient.send(address, value);
    return;
  }

  if (typeof value === 'string') {
    oscClient.send(address, value);
    return;
  }

  if (typeof value === 'boolean') {
    oscClient.send(address, value ? 1 : 0);
  }
}

function numberOrFallback(value, fallback = MISSING_NUMBER) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function stringOrFallback(value, fallback = MISSING_STRING) {
  return typeof value === 'string' ? value : fallback;
}

function buildOscMessages(data, derived) {
  return [
    ['/weather/api/temp', numberOrFallback(derived.temp)],
    ['/weather/api/humidity', numberOrFallback(derived.humidity)],
    ['/weather/api/wind', numberOrFallback(derived.wind)],
    ['/weather/api/main', stringOrFallback(derived.main)],
    ['/weather/api/mainCode', numberOrFallback(derived.mainCode, -1)],
    ['/weather/api/sunrise_norm', numberOrFallback(derived.sunriseNorm, -1)],
    ['/weather/api/sunset_norm', numberOrFallback(derived.sunsetNorm, -1)],
    ['/weather/api/day_length_norm', numberOrFallback(derived.dayLengthNorm, -1)],
    ['/weather/api/day_progress', numberOrFallback(derived.dayProgress, -1)],
    ['/weather/api/isDay', numberOrFallback(derived.isDay, -1)],
    ['/weather/api/coord/lon', numberOrFallback(data.coord?.lon)],
    ['/weather/api/coord/lat', numberOrFallback(data.coord?.lat)],
    ['/weather/api/weather/0/id', numberOrFallback(data.weather?.[0]?.id)],
    ['/weather/api/weather/0/main', stringOrFallback(data.weather?.[0]?.main)],
    ['/weather/api/weather/0/description', stringOrFallback(data.weather?.[0]?.description)],
    ['/weather/api/weather/0/icon', stringOrFallback(data.weather?.[0]?.icon)],
    ['/weather/api/base', stringOrFallback(data.base)],
    ['/weather/api/main/temp', numberOrFallback(data.main?.temp)],
    ['/weather/api/main/feels_like', numberOrFallback(data.main?.feels_like)],
    ['/weather/api/main/temp_min', numberOrFallback(data.main?.temp_min)],
    ['/weather/api/main/temp_max', numberOrFallback(data.main?.temp_max)],
    ['/weather/api/main/pressure', numberOrFallback(data.main?.pressure)],
    ['/weather/api/main/humidity', numberOrFallback(data.main?.humidity)],
    ['/weather/api/main/sea_level', numberOrFallback(data.main?.sea_level)],
    ['/weather/api/main/grnd_level', numberOrFallback(data.main?.grnd_level)],
    ['/weather/api/visibility', numberOrFallback(data.visibility)],
    ['/weather/api/wind/speed', numberOrFallback(data.wind?.speed)],
    ['/weather/api/wind/deg', numberOrFallback(data.wind?.deg)],
    ['/weather/api/wind/gust', numberOrFallback(data.wind?.gust)],
    ['/weather/api/clouds/all', numberOrFallback(data.clouds?.all)],
    ['/weather/api/rain/1h', numberOrFallback(data.rain?.['1h'])],
    ['/weather/api/rain/3h', numberOrFallback(data.rain?.['3h'])],
    ['/weather/api/snow/1h', numberOrFallback(data.snow?.['1h'])],
    ['/weather/api/snow/3h', numberOrFallback(data.snow?.['3h'])],
    ['/weather/api/dt', numberOrFallback(data.dt)],
    ['/weather/api/sys/type', numberOrFallback(data.sys?.type)],
    ['/weather/api/sys/id', numberOrFallback(data.sys?.id)],
    ['/weather/api/sys/country', stringOrFallback(data.sys?.country)],
    ['/weather/api/sys/sunrise', numberOrFallback(data.sys?.sunrise)],
    ['/weather/api/sys/sunset', numberOrFallback(data.sys?.sunset)],
    ['/weather/api/timezone', numberOrFallback(data.timezone)],
    ['/weather/api/id', numberOrFallback(data.id)],
    ['/weather/api/name', stringOrFallback(data.name)],
    ['/weather/api/cod', typeof data.cod === 'string' ? data.cod : numberOrFallback(data.cod)]
  ];
}

function sendOrderedOscMessages(messages) {
  messages.forEach(([address, value]) => {
    sendOscValue(address, value);
  });
}

// --- Fonctions météo ---

async function getWeather() {
  const url = `https://api.openweathermap.org/data/2.5/weather?q=${CITY}&appid=${API_KEY}&units=metric`;

  const resp = await fetch(url);

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`HTTP ${resp.status} – ${errText}`);
  }

  const data = await resp.json();
  return data;
}

function mapConditionToCode(main) {
  if (!main) return -1;
  return CONDITION_CODES[main] ?? -1;
}

async function sendWeather() {
  try {
    const data = await getWeather();

    const temp = data.main?.temp;
    const humidity = data.main?.humidity;
    const wind = data.wind?.speed;
    const main = data.weather?.[0]?.main || 'Unknown';  // ex: "Clear", "Clouds", "Rain"
    const mainCode = mapConditionToCode(main);

    // ---- Soleil -> valeurs musicales ----
    const timezoneOffset = data.timezone ?? 0;    // en secondes
    const sunriseTs = data.sys?.sunrise;          // timestamp UTC (s)
    const sunsetTs  = data.sys?.sunset;           // timestamp UTC (s)
    const nowTs     = data.dt;                    // "maintenant" UTC (s)

    let sunriseHour, sunsetHour;
    let sunriseNorm, sunsetNorm;
    let dayLengthHours, dayLengthNorm;
    let dayProgress, isDay;

    if (typeof sunriseTs === 'number' && typeof sunsetTs === 'number') {
      // heures locales 0–24
      sunriseHour    = toLocalHourFloat(sunriseTs, timezoneOffset);
      sunsetHour     = toLocalHourFloat(sunsetTs,  timezoneOffset);

      // durée du jour
      dayLengthHours = Math.max(0, sunsetHour - sunriseHour); // en heures
      dayLengthNorm  = dayLengthHours / 24;                   // 0–1

      // positions normalisées
      sunriseNorm    = sunriseHour / 24;                      // 0–1
      sunsetNorm     = sunsetHour / 24;                       // 0–1

      // progression dans la journée (0 = lever, 1 = coucher)
      if (typeof nowTs === 'number') {
        const nowHour = toLocalHourFloat(nowTs, timezoneOffset); // 0–24

        if (nowHour < sunriseHour) {
          isDay = 0;
          dayProgress = 0;     // avant le lever
        } else if (nowHour > sunsetHour) {
          isDay = 0;
          dayProgress = 1;     // après le coucher
        } else {
          isDay = 1;
          dayProgress = (nowHour - sunriseHour) / (sunsetHour - sunriseHour); // 0–1
        }
      }
    }

    console.log('Météo reçue :', {
      city: CITY,
      temp,
      humidity,
      wind,
      main,
      mainCode,
      sunriseHour,
      sunsetHour,
      sunriseNorm,
      sunsetNorm,
      dayLengthHours,
      dayLengthNorm,
      dayProgress,
      isDay
      
    });

    // ---- Envois OSC : ordre et nombre fixes ----
    const oscMessages = buildOscMessages(data, {
      temp,
      humidity,
      wind,
      main,
      mainCode,
      sunriseNorm,
      sunsetNorm,
      dayLengthNorm,
      dayProgress,
      isDay
    });
    console.log(`Nombre de sorties OSC envoyees : ${oscMessages.length}`);
    sendOrderedOscMessages(oscMessages);

  } catch (err) {
    console.error('Erreur dans sendWeather():', err.message);
  }
}


// ====== BOUCLE ======

// Premier envoi au lancement
sendWeather();

// Puis rafraîchissement régulier
setInterval(sendWeather, REFRESH_EVERY_MS);

// Fermeture propre
process.on('SIGINT', () => {
  console.log('\nFermeture du client OSC...');
  oscClient.close();
  process.exit();
});
