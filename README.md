#  WEATHER → OSC → MAX/MSP  
### *Weather-driven sound & music installation toolkit*

---

##  Concept

**WEATHER → OSC → MAX/MSP** est un projet de **sonification de la météo en temps réel**.

Il permet de transformer des données météorologiques réelles — température, vent, humidité, pluie, soleil, conditions extrêmes — en **paramètres musicaux exploitables dans Max/MSP** via OSC.

La météo devient ici :
- une **partition lente**
- un **système de modulation global**
- une **force extérieure incontrôlable**
- une écriture musicale qui échappe à l’interprète

> Quand le soleil se lève ailleurs, le son change ici.  
> Quand une tempête apparaît, la structure se transforme.

---

##  Intention artistique

Ce projet ne cherche pas la précision scientifique, mais une **traduction sensible du réel**.

La météo est :
- continue
- non cyclique
- imprévisible
- mondiale

Elle est idéale pour :
- des **installations génératives**
- des **pièces longues durées**
- des dispositifs autonomes
- des systèmes qui évoluent sans intervention humaine

Le son n’est plus déclenché :  
il **réagit à un monde extérieur**.

---

##  Principe général


---

## 🎛️ Données météorologiques exploitées

Les données envoyées sont pensées pour être **directement musicales** :

- Température
- Humidité
- Vent (force + direction)
- Conditions météo (pluie, brouillard, sable, neige…)
- Lever / coucher du soleil
- Durée du jour
- Progression dans la journée
- Jour / nuit
- Conditions extrêmes (tempêtes, poussière, tornade…)

Chaque donnée peut devenir :
- une fréquence
- une amplitude
- un filtre
- une densité
- une probabilité
- un changement de mode ou de forme

---

##  Conditions météo → codes symboliques

Les conditions météo sont converties en **codes entiers**, facilitant les changements structurels.

| Code | Condition        |
|-----:|------------------|
| 0    | Clear            |
| 1    | Clouds           |
| 2    | Rain             |
| 3    | Drizzle          |
| 4    | Thunderstorm     |
| 5    | Snow             |
| 6    | Mist             |
| 7    | Fog              |
| 8    | Smoke            |
| 9    | Haze             |
| 10   | Dust             |
| 11   | Sand             |
| 12   | Ash              |
| 13   | Squall           |
| 14   | Tornado          |

Ces codes peuvent servir à :
- changer d’algorithme
- basculer entre scènes
- modifier radicalement la texture sonore

---

##  Messages OSC envoyés

Exemples d’adresses OSC :

```text
/weather/temp              → température (°C)
/weather/humidity          → humidité (%)
/weather/wind              → vent (m/s)
/weather/wind_deg          → direction du vent
/weather/main              → condition météo (texte)
/weather/mainCode          → condition météo (code)
/weather/rain              → pluie (mm)
/weather/snow              → neige (mm)

/weather/sunrise_norm      → lever du soleil (0–1)
/weather/sunset_norm       → coucher du soleil (0–1)
/weather/day_length_norm   → durée du jour (0–1)
/weather/day_progress      → progression dans la journée (0–1)
/weather/isDay             → jour / nuit (0 ou 1)


🧰 Contenu du projet
.
├── weather-to-max.js
│   → récupération météo minimale
│
├── weather-osc.js
│   → météo → OSC (version simple)
│
├── weather-to-max-to-osc.js
│   → version principale :
│     soleil, journée, codes météo, stabilité réseau
│
├── weather-to-max-to-osc2.js
│   → variante expérimentale
│
├── weather-extreme.js
│   → scan de villes aux conditions extrêmes
│     (sable, tempêtes, neige, tornades…)
│
├── weather-to-max-osc.maxpat
│   → patch Max/MSP de réception OSC
│
└── README.md

🔑 Prérequis

Node.js ≥ 18

Max/MSP

Une clé API OpenWeatherMap

Créer un fichier .env :

API_CODE=ta_cle_openweathermap

Lancement :
npm install
node weather-to-max-to-osc.js


Dans Max/MSP :

udpreceive 7400

Cas d’usage artistiques

installations sonores autonomes

œuvres dépendantes d’un lieu distant

performances météo-dépendantes

pièces génératives longue durée

art sonore & data-sonification

pédagogie (Max, OSC, sonification)

Approche recommandée

éviter le mapping direct “1 donnée = 1 paramètre”

préférer des relations indirectes

laisser le système évoluer lentement

accepter l’imprévisible

penser l’installation comme un organisme vivant

Licence

MIT — libre d’utilisation, de modification et de diffusion.

Si tu réalises une installation ou une pièce avec ce projet :
je serais très curieux de l’entendre ou de la voir.

La météo écrit.
Le système écoute.
Le son apparaît.
