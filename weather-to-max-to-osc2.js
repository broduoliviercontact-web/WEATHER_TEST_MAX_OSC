const { Client } = require('node-osc');
require('dotenv').config();

const API_KEY = process.env.API_CODE;              // ta clé API
const CITY = 'tunis';                          // ville
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

    // Texte + code météo
    oscClient.send('/weather/main', main);
    oscClient.send('/weather/mainCode', mainCode);

    // Soleil : valeurs déjà "musicales"
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
