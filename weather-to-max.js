require('dotenv').config();

const API_KEY = process.env.API_CODE; // à mettre en variable d'environnement en vrai ;)
const CITY = 'Paris'; // change si tu veux

async function getWeather() {
  const url = `https://api.openweathermap.org/data/2.5/weather?q=${CITY}&appid=${API_KEY}&units=metric`;

  try {
    const resp = await fetch(url);

    if (!resp.ok) {
      // Erreur HTTP (mauvaise clé, ville invalide, etc.)
      const errText = await resp.text();
      throw new Error(`HTTP ${resp.status} – ${errText}`);
    }

    const data = await resp.json();

    return {
      temp: data.main.temp,
      wind: data.wind.speed,
      humidity: data.main.humidity
    };
  } catch (err) {
    return { error: err.message };
  }
}

// Appel pour tester
getWeather()
  .then(console.log)
  .catch(console.error);

// Si tu veux aussi l’export pour un autre fichier :
module.exports = { getWeather };
