const { Client } = require('node-osc');
require('dotenv').config();

const API_KEY = process.env.API_CODE;              // ta clé API
const CITY = 'paris';                          // ville
const OSC_IP = '127.0.0.1';                        // IP de la machine où tourne Max
const OSC_PORT = 7400;                             // port UDP dans Max (udpreceive 7400)
const REFRESH_EVERY_MS = 1 * 60 * 1000;            // intervalle (ici 1 min)

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

function pad2(n) {
  return String(n).padStart(2, '0');
}

// Formate en ISO local sans décalage timezone (YYYY-MM-DDTHH:MM:SS)
function formatLocalIso(utcSeconds, timezoneOffsetSeconds) {
  const d = new Date((utcSeconds + timezoneOffsetSeconds) * 1000);
  const Y = d.getUTCFullYear();
  const M = pad2(d.getUTCMonth() + 1);
  const D = pad2(d.getUTCDate());
  const h = pad2(d.getUTCHours());
  const m = pad2(d.getUTCMinutes());
  const s = pad2(d.getUTCSeconds());
  return `${Y}-${M}-${D}T${h}:${m}:${s}`;
}

// Formate en heure lisible HH:MM:SS
function formatLocalTimeHMS(utcSeconds, timezoneOffsetSeconds) {
  const d = new Date((utcSeconds + timezoneOffsetSeconds) * 1000);
  const h = pad2(d.getUTCHours());
  const m = pad2(d.getUTCMinutes());
  const s = pad2(d.getUTCSeconds());
  return `${h}:${m}:${s}`;
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
    const windDeg = data.wind?.deg; // direction du vent en degrés
    const main = data.weather?.[0]?.main || 'Unknown';  // ex: "Clear", "Clouds", "Rain"
    const mainCode = mapConditionToCode(main);

    // ---- Rain / Snow (mm) ----
    // OpenWeather peut renvoyer "1h" ou "3h" (ou aucune des deux).
    let rain = undefined;
    if (data.rain) {
      rain = (typeof data.rain['1h'] === 'number') ? data.rain['1h']
           : (typeof data.rain['3h'] === 'number') ? data.rain['3h']
           : undefined;
    }

    let snow = undefined;
    if (data.snow) {
      snow = (typeof data.snow['1h'] === 'number') ? data.snow['1h']
           : (typeof data.snow['3h'] === 'number') ? data.snow['3h']
           : undefined;
    }

    // ---- Soleil -> valeurs musicales et heures locales ----
    const timezoneOffset = data.timezone ?? 0;    // en secondes
    const sunriseTs = data.sys?.sunrise;          // timestamp UTC (s)
    const sunsetTs  = data.sys?.sunset;           // timestamp UTC (s)
    const nowTs     = data.dt;                    // "maintenant" UTC (s)

    let sunriseHour, sunsetHour, nowHour;
    let sunriseNorm, sunsetNorm;
    let dayLengthHours, dayLengthNorm;
    let dayProgress, isDay;

    // formatted strings
    let nowIso, nowLocalStr, sunriseIso, sunriseLocalStr, sunsetIso, sunsetLocalStr;

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
    }

    if (typeof nowTs === 'number') {
      nowHour = toLocalHourFloat(nowTs, timezoneOffset);
      nowIso = formatLocalIso(nowTs, timezoneOffset);
      nowLocalStr = formatLocalTimeHMS(nowTs, timezoneOffset);
    }

    if (typeof sunriseTs === 'number') {
      sunriseIso = formatLocalIso(sunriseTs, timezoneOffset);
      sunriseLocalStr = formatLocalTimeHMS(sunriseTs, timezoneOffset);
    }

    if (typeof sunsetTs === 'number') {
      sunsetIso = formatLocalIso(sunsetTs, timezoneOffset);
      sunsetLocalStr = formatLocalTimeHMS(sunsetTs, timezoneOffset);
    }

    // progression dans la journée (0 = lever, 1 = coucher)
    if (typeof nowHour === 'number' && typeof sunriseHour === 'number' && typeof sunsetHour === 'number') {
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

    console.log('Météo reçue :', {
      city: CITY,
      temp,
      humidity,
      wind,
      windDeg,
      main,
      mainCode,
      rain,
      snow,
      nowHour,
      nowIso,
      nowLocalStr,
      sunriseHour,
      sunriseIso,
      sunriseLocalStr,
      sunsetHour,
      sunsetIso,
      sunsetLocalStr,
      sunriseNorm,
      sunsetNorm,
      dayLengthHours,
      dayLengthNorm,
      dayProgress,
      isDay
    });

    // ---- Envois OSC ----

    if (typeof temp === 'number') {
      oscClient.send('/weather/temp', temp);
    }

    if (typeof humidity === 'number') {
      oscClient.send('/weather/humidity', humidity);
    }

    if (typeof wind === 'number') {
      oscClient.send('/weather/wind', wind);
    }

    if (typeof windDeg === 'number') {
      oscClient.send('/weather/wind_deg', windDeg);
    }

    // Texte + code météo
    oscClient.send('/weather/main', main);
    oscClient.send('/weather/mainCode', mainCode);

    // Rain / Snow (mm)
    if (typeof rain === 'number') {
      // mm for last hour (or 3 hours if only available)
      oscClient.send('/weather/rain', rain);
    }
    if (typeof snow === 'number') {
      oscClient.send('/weather/snow', snow);
    }

    // Heures locales (float 0–24)
    if (typeof nowHour === 'number') {
      oscClient.send('/weather/now_hour', nowHour);            // ex: 13.5 = 13h30
    }
    if (typeof sunriseHour === 'number') {
      oscClient.send('/weather/sunrise_hour', sunriseHour);
    }
    if (typeof sunsetHour === 'number') {
      oscClient.send('/weather/sunset_hour', sunsetHour);
    }

    // Heures formatées en texte (ISO et lisible)
    if (typeof nowIso === 'string') {
      oscClient.send('/weather/now_iso', nowIso);
    }
    if (typeof nowLocalStr === 'string') {
      oscClient.send('/weather/now_local', nowLocalStr);
    }
    if (typeof sunriseIso === 'string') {
      oscClient.send('/weather/sunrise_iso', sunriseIso);
    }
    if (typeof sunriseLocalStr === 'string') {
      oscClient.send('/weather/sunrise_local', sunriseLocalStr);
    }
    if (typeof sunsetIso === 'string') {
      oscClient.send('/weather/sunset_iso', sunsetIso);
    }
    if (typeof sunsetLocalStr === 'string') {
      oscClient.send('/weather/sunset_local', sunsetLocalStr);
    }

    // Soleil : valeurs déjà "musicales" normalisées
    if (typeof sunriseNorm === 'number') {
      oscClient.send('/weather/sunrise_norm', sunriseNorm);       // 0–1
    }
    if (typeof sunsetNorm === 'number') {
      oscClient.send('/weather/sunset_norm', sunsetNorm);         // 0–1
    }
    if (typeof dayLengthNorm === 'number') {
      oscClient.send('/weather/day_length_norm', dayLengthNorm);  // 0–1
    }
    if (typeof dayProgress === 'number') {
      oscClient.send('/weather/day_progress', dayProgress);       // 0–1
    }
    if (typeof isDay === 'number') {
      oscClient.send('/weather/isDay', isDay);                    // 0 ou 1
    }

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