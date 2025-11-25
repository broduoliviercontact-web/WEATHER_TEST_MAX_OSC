const { Client } = require('node-osc');
require('dotenv').config();

// --- Configuration ---
const API_KEY = process.env.API_CODE;         // ta clé API OpenWeatherMap
const CITY = 'london';                         // ville par défaut (utilisée si data.name absent)
const OSC_IP = '127.0.0.1';                   // IP où tourne Max / udpreceive
const OSC_PORT = 7400;                        // port UDP dans Max
let REFRESH_EVERY_MS = 60 * 1000;             // intervalle par défaut (ms) — change si besoin

// Backoff (en ms) pour erreurs réseau / rate-limit
const BACKOFF_BASE = 2000;    // 2s
const BACKOFF_MAX = 120_000;  // 2min
const BACKOFF_MULT = 2;

// --- Mapping conditions -> codes entiers ---
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

// --- Utils date/heure ---
function pad2(n) {
  return String(n).padStart(2, '0');
}

// Convertit timestamp UTC (s) + offset (s) -> heure locale float 0-24
function toLocalHourFloat(utcSeconds, timezoneOffsetSeconds) {
  const d = new Date((utcSeconds + timezoneOffsetSeconds) * 1000);
  const h = d.getUTCHours();
  const m = d.getUTCMinutes();
  const s = d.getUTCSeconds();
  return h + m / 60 + s / 3600;
}

// ISO local YYYY-MM-DDTHH:MM:SS (sans suffixe fuseau)
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

// Heure lisible HH:MM:SS
function formatLocalTimeHMS(utcSeconds, timezoneOffsetSeconds) {
  const d = new Date((utcSeconds + timezoneOffsetSeconds) * 1000);
  const h = pad2(d.getUTCHours());
  const m = pad2(d.getUTCMinutes());
  const s = pad2(d.getUTCSeconds());
  return `${h}:${m}:${s}`;
}

// --- Requête API ---
async function getWeather() {
  if (!API_KEY) {
    const e = new Error('API key non fournie (process.env.API_CODE)');
    e.status = 0;
    throw e;
  }

  const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(CITY)}&appid=${API_KEY}&units=metric`;
  const resp = await fetch(url);

  if (!resp.ok) {
    const errText = await resp.text();
    const err = new Error(`HTTP ${resp.status} – ${errText}`);
    err.status = resp.status;
    throw err;
  }

  const data = await resp.json();
  return data;
}

function mapConditionToCode(main) {
  if (!main) return -1;
  return CONDITION_CODES[main] ?? -1;
}

// --- Envoi / traitement météo ---
async function sendWeather() {
  const data = await getWeather();

  // Valeurs brutes
  const temp = data.main?.temp;
  const humidity = data.main?.humidity;
  const wind = data.wind?.speed;
  const windDeg = data.wind?.deg;
  const main = data.weather?.[0]?.main || 'Unknown';
  const mainCode = mapConditionToCode(main);

  // Rain / Snow (priorise 1h puis 3h)
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

  // Heures / soleil
  const timezoneOffset = data.timezone ?? 0; // en secondes
  const sunriseTs = data.sys?.sunrise;
  const sunsetTs = data.sys?.sunset;
  const nowTsApi = data.dt; // timestamp renvoyé par l'API (UTC seconds)
  const nowTsLocalClock = Math.floor(Date.now() / 1000); // timestamp côté client (UTC seconds)

  let sunriseHour, sunsetHour, nowHour;               // valeurs "principales" (on choisit localClock pour now)
  let sunriseNorm, sunsetNorm, dayLengthHours, dayLengthNorm;
  let dayProgress, isDay;

  // formatted strings (API-based)
  let nowIsoApi, nowLocalStrApi, nowHourApi;
  // formatted strings (local clock but converted to city timezone)
  let nowIso, nowLocalStr, nowHourLocal;

  if (typeof sunriseTs === 'number') {
    sunriseHour = toLocalHourFloat(sunriseTs, timezoneOffset);
    sunriseIso = formatLocalIso(sunriseTs, timezoneOffset);
    sunriseLocalStr = formatLocalTimeHMS(sunriseTs, timezoneOffset);
    sunriseNorm = sunriseHour / 24;
  }
  if (typeof sunsetTs === 'number') {
    sunsetHour = toLocalHourFloat(sunsetTs, timezoneOffset);
    sunsetIso = formatLocalIso(sunsetTs, timezoneOffset);
    sunsetLocalStr = formatLocalTimeHMS(sunsetTs, timezoneOffset);
    sunsetNorm = sunsetHour / 24;
  }
  if (typeof sunriseHour === 'number' && typeof sunsetHour === 'number') {
    dayLengthHours = Math.max(0, sunsetHour - sunriseHour);
    dayLengthNorm = dayLengthHours / 24;
  }

  // --- now values from API (as before) ---
  if (typeof nowTsApi === 'number') {
    nowHourApi = toLocalHourFloat(nowTsApi, timezoneOffset);
    nowIsoApi = formatLocalIso(nowTsApi, timezoneOffset);
    nowLocalStrApi = formatLocalTimeHMS(nowTsApi, timezoneOffset);
  }

  // --- now values from local clock (this fixes the "stuck" nowLocalStr problem) ---
  if (typeof nowTsLocalClock === 'number') {
    // convert client timestamp to city's local time using timezoneOffset (seconds)
    nowHourLocal = toLocalHourFloat(nowTsLocalClock, timezoneOffset);
    nowIso = formatLocalIso(nowTsLocalClock, timezoneOffset);
    nowLocalStr = formatLocalTimeHMS(nowTsLocalClock, timezoneOffset);
    // choose the main "nowHour" to be the local-clock version so that consumers get an actual moving clock
    nowHour = nowHourLocal;
  }

  // progression dans la journée (utilise nowHour calculé depuis local clock si possible)
  if (typeof nowHour === 'number' && typeof sunriseHour === 'number' && typeof sunsetHour === 'number') {
    if (nowHour < sunriseHour) {
      isDay = 0;
      dayProgress = 0;
    } else if (nowHour > sunsetHour) {
      isDay = 0;
      dayProgress = 1;
    } else {
      isDay = 1;
      dayProgress = (nowHour - sunriseHour) / (sunsetHour - sunriseHour);
    }
  }

  // Ville : on envoie preferentiellement data.name si présent
  const cityName = (typeof data.name === 'string' && data.name.length > 0) ? data.name : CITY;

  // Log synthétique (ajout des deux sources pour "now")
  console.log('Météo reçue :', {
    city: cityName,
    temp, humidity, wind, windDeg, main, mainCode, rain, snow,
    // now: local clock (moving)
    nowHour,
    nowIso,
    nowLocalStr,
    // now from API (may be identical across fetches)
    nowHourApi,
    nowIsoApi,
    nowLocalStrApi,
    sunriseHour, sunriseIso, sunriseLocalStr,
    sunsetHour, sunsetIso, sunsetLocalStr,
    sunriseNorm, sunsetNorm, dayLengthHours, dayLengthNorm, dayProgress, isDay
  });

  // ---- Envois OSC ----

  // city (string)
  if (typeof cityName === 'string') {
    oscClient.send('/weather/city', cityName);
  }

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

  // main (string) + code (int)
  oscClient.send('/weather/main', main);
  oscClient.send('/weather/mainCode', mainCode);

  // precipitation (mm)
  if (typeof rain === 'number') {
    oscClient.send('/weather/rain', rain);
  }
  if (typeof snow === 'number') {
    oscClient.send('/weather/snow', snow);
  }

  // Heures locales float 0-24 (on envoie la version "local clock" comme now_hour)
  if (typeof nowHour === 'number') {
    oscClient.send('/weather/now_hour', nowHour);
  }
  if (typeof sunriseHour === 'number') {
    oscClient.send('/weather/sunrise_hour', sunriseHour);
  }
  if (typeof sunsetHour === 'number') {
    oscClient.send('/weather/sunset_hour', sunsetHour);
  }

  // formatted strings (NOW) : envoi de la version "locale" (clock) comme nom principal...
  if (typeof nowIso === 'string') {
    oscClient.send('/weather/now_iso', nowIso);
  }
  if (typeof nowLocalStr === 'string') {
    oscClient.send('/weather/now_local', nowLocalStr);
  }

  // ...et on envoie aussi les versions basées sur l'API en suffixant _api pour debug/trace
  if (typeof nowIsoApi === 'string') {
    oscClient.send('/weather/now_iso_api', nowIsoApi);
  }
  if (typeof nowLocalStrApi === 'string') {
    oscClient.send('/weather/now_local_api', nowLocalStrApi);
  }
  if (typeof nowHourApi === 'number') {
    oscClient.send('/weather/now_hour_api', nowHourApi);
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

  // normalisations / progression
  if (typeof sunriseNorm === 'number') {
    oscClient.send('/weather/sunrise_norm', sunriseNorm);
  }
  if (typeof sunsetNorm === 'number') {
    oscClient.send('/weather/sunset_norm', sunsetNorm);
  }
  if (typeof dayLengthNorm === 'number') {
    oscClient.send('/weather/day_length_norm', dayLengthNorm);
  }
  if (typeof dayProgress === 'number') {
    oscClient.send('/weather/day_progress', dayProgress);
  }
  if (typeof isDay === 'number') {
    oscClient.send('/weather/isDay', isDay);
  }
}

// ====== BOUCLE ASYNCHRONE + BACKOFF ======
let stopRequested = false;

async function runLoop() {
  let backoff = 0;
  while (!stopRequested) {
    try {
      await sendWeather();
      // si tout va bien, reset backoff
      backoff = 0;
      // attente normale
      await new Promise(resolve => setTimeout(resolve, REFRESH_EVERY_MS));
    } catch (err) {
      // log et backoff
      const statusInfo = err?.status ? ` (status ${err.status})` : '';
      console.error('Erreur en requêtant l’API ou en traitant la réponse' + statusInfo + ':', err.message || err);
      if (backoff === 0) backoff = BACKOFF_BASE;
      else backoff = Math.min(Math.floor(backoff * BACKOFF_MULT), BACKOFF_MAX);
      const jitter = Math.floor(Math.random() * 1000);
      const wait = backoff + jitter;
      console.log(`Attente de ${wait} ms avant nouvelle tentative (backoff).`);
      await new Promise(resolve => setTimeout(resolve, wait));
    }
  }
}

// Démarrage
runLoop();

// Fermeture propre
process.on('SIGINT', () => {
  console.log('\nFermeture du client OSC...');
  stopRequested = true;
  try { oscClient.close(); } catch (e) {}
  process.exit();
});