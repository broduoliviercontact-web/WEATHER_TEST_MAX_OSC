// find-extreme-weather.js
require('dotenv').config();

const API_KEY = process.env.API_CODE;

// Quelques villes "à risque" (poussière, sable, etc.)
// Quelques dizaines de grandes villes réparties dans le monde
const CITY_IDS = [
  // 🇬🇧 Royaume-Uni & Irlande
  2643741, // London
  2644688, // Birmingham
  2633352, // Manchester
  2654675, // Glasgow

  // 🇫🇷 / 🇩🇪 / 🇪🇸 / 🇮🇹 / 🇳🇱 / 🇷🇺 etc.
  2988507, // Paris
  2990969, // Lyon
  2911298, // Hamburg
  2925535, // Frankfurt am Main
  2950159, // Berlin
  3120501, // Barcelona
  3128760, // Madrid
  2759794, // Amsterdam
  6542283, // Milan
  524901,  // Moscow
  3220802, // Frankfurt (autre ID)
  745044,  // Istanbul
  2643743, // London (centre)

  // 🇺🇸 / 🇨🇦
  5128581, // New York
  4140963, // Washington DC
  4930956, // Boston
  5106834, // Newark
  5391959, // San Francisco
  5368361, // Los Angeles
  5809844, // Seattle
  4099974, // Little Rock
  4440906, // Jackson

// Polar / froid
  6255152, // Antarctica (global)
  2729907, // Longyearbyen
  3413829, // Reykjavik
  3833367, // Ushuaia

  // Déserts / chaleur
  108410,  // Riyadh
  2377450, // Nouakchott
  2377457, // Nouadhibou
  2253354, // Dakar
  2360372, // Gorom-Gorom
  2444219, // Goure
  244878,  // Biltine
  286621,  // Salalah

  // Tropiques Asie
  1267394, // Kavali
  1620010, // Doembang Nangbuat
  1568770, // Quang Ngai

  // Ouragans / triangle des Bermudes
  4164138, // Miami
  4566966, // San Juan
  3580733, // Bodden Town
  3489854, // Kingston
  3689147, // Barranquilla
  3374083, // Bathsheba
  3374346, // Ponta do Sol
  3374336, // Porto Novo

  // Océan Indien
  1106677,  // Bambous Virieux


  // 🌵 / 🌪 régions plus “extrêmes”
  360630,  // Cairo
  290030,  // Doha
  292223,  // Dubai
  1273294, // Delhi
  3530597, // Mexico City
  1816670, // Beijing
  2147714, // Sydney
  1850147, // Tokyo
  3117735, // Madrid (autre ID)
];

// main -> mainCode
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

function mapConditionToCode(main) {
  if (!main) return -1;
  return CONDITION_CODES[main] ?? -1;
}

async function fetchCityWeather(id) {
  const url = `https://api.openweathermap.org/data/2.5/weather?id=${id}&appid=${API_KEY}&units=metric`;
  const resp = await fetch(url);

  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`HTTP ${resp.status} – ${txt}`);
  }

  return resp.json();
}

async function findExtremeWeatherCities() {
  const results = [];

  for (const id of CITY_IDS) {
    try {
      const data = await fetchCityWeather(id);
      const main = data.weather?.[0]?.main;
      const code = mapConditionToCode(main);

      if (code >= 5 && code <= 14) {
        results.push({
          id,
          name: data.name,
          main,
          mainCode: code
        });
      }
    } catch (err) {
      console.error(`Erreur pour la ville ${id}:`, err.message);
    }
  }

  return results;
}

findExtremeWeatherCities()
  .then(list => {
    if (list.length === 0) {
      console.log("Aucune des villes de la liste n'a un mainCode entre 10 et 14.");
    } else {
      console.log("Villes avec mainCode entre 10 et 14 :");
      list.forEach(c => {
        console.log(`- ${c.name} (${c.main}) → code ${c.mainCode}`);
      });
    }
  })
  .catch(err => {
    console.error('Erreur globale :', err.message);
  });
