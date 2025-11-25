# 🌦️ Weather → OSC → Max/MSP

Ce projet transforme la météo réelle en **contrôleurs musicaux** dans **Max/MSP**, via un script **Node.js** qui :

- appelle l’API **OpenWeatherMap** pour récupérer la météo de plusieurs villes (température, humidité, vent, conditions…)
- convertit ces infos en valeurs **utiles pour la musique** (0–127, Hz, codes de conditions)
- envoie tout ça en **OSC** vers un patch **Max/MSP** qui peut piloter synthés, effets, MIDI, etc.

Parfait pour créer des **installations météo-musicales**, des pièces génératives ou juste jouer avec la pluie, le vent et le soleil 🎛️🌧️

---

## ✨ Fonctionnalités

- Récupération de la météo en temps réel via **OpenWeatherMap**
- Envoi des données en **OSC** vers Max/MSP (`udpreceive`)
- Données exposées :
  - `temp` (°C)
  - `humidity` (%)
  - `wind` (m/s)
  - `weather.main` (ex: `Clear`, `Rain`, `Dust`, etc.)
  - `weather.mainCode` (version numérique des conditions météo)
- Support de villes "extrêmes" (déserts, pôles, zones tropicales, triangle des Bermudes 😈)
- Pensé pour mapper facilement vers :
  - **0–127** (MIDI)
  - **fréquences** (via `mtof` ou mapping direct)

---

## 🧰 Prérequis

- **Node.js** ≥ 18 (pour avoir `fetch` intégré)
- **Max/MSP** (version récente)
- Un compte **OpenWeatherMap** :  
  👉 créer un compte, récupérer une **API key** (clé gratuite suffisante pour l’endpoint `/weather`)

---

## 📁 Structure (proposée)

```bash
.
├── weather-to-max.js              # Version minimaliste : récup météo (Node seulement)
├── weather-osc.js                 # Version simple : météo → OSC pour une ville
├── weather-to-max-to-osc.js       # Version avancée : météo → OSC (+ mainCode, .env)
├── weather-to-max-to-osc2.js      # Variante / évolution de la version avancée
├── weather-extreme.js             # Scan de villes "extrêmes" (Dust, Sand, Squall, etc.)
├── max/
│   └── weather_receiver.maxpat    # Patch Max pour recevoir l’OSC
├── .env                           # (optionnel) clé API en variable d'environnement
└── README.md
