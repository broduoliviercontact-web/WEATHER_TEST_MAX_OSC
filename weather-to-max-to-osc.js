// weather-osc.js

const { Client } = require('node-osc');
require('dotenv').config();

// ---- CONFIG ----
const API_KEY = process.env.API_CODE; // idéalement: process.env.OPENWEATHER_API_KEY
const CITY = 'tunis'; // change si tu veux

const OSC_IP = '127.0.0.1';  // IP de la machine où tourne Max (127.0.0.1 si même ordi)
const OSC_PORT = 7400;       // Port UDP utilisé dans Max (à faire matcher)

// ---- OSC CLIENT ----
const oscClient = new Client(OSC_IP, OSC_PORT);

// ---- METEO ----
async function getWeather() {
  const url = `https://api.openweathermap.org/data/2.5/weather?q=${CITY}&appid=${API_KEY}&units=metric`;

  try {
    const resp = await fetch(url);

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`HTTP ${resp.status} – ${errText}`);
    }

    const data = await resp.json();

    return {
      temp: data.main.temp,
      wind: data.wind.speed,
      humidity: data.main.humidity,
      pressure: data.main.pressure,
      main : data.weather[0].main,
      clouds: data.clouds.all
    };
  } catch (err) {
    return { error: err.message };
  }
}

// ---- ENVOI OSC ----
async function sendWeather() {
  const data = await getWeather();

  if (data.error) {
    console.error('Erreur météo :', data.error);
    return;
  }

  console.log('Météo =', data);

  // On envoie 3 messages OSC séparés
  oscClient.send('/weather/temp', data.temp);
  oscClient.send('/weather/humidity', data.humidity);
  oscClient.send('/weather/wind', data.wind);
}

// 1er envoi direct
sendWeather();

// Puis toutes les 5 minutes par exemple
setInterval(sendWeather, 5 * 60 * 1000);

// Clean à la fermeture
process.on('SIGINT', () => {
  oscClient.close();
  process.exit();
});
