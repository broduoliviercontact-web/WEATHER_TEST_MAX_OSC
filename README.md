# WEATHER -> OSC -> MAX/MSP

Weather-driven sound and music toolkit for Max/MSP.

This project turns live OpenWeather data into OSC messages that can drive a Max/MSP patch, an installation, a generative composition, or any system that reacts to a changing external world.

## Overview

The idea is simple:

1. A Node.js script queries the OpenWeather API.
2. Weather values are translated into stable OSC outputs.
3. Max/MSP receives those values and maps them to sound, structure, rhythm, density, filters, or scene changes.

The weather becomes a score:

- slow
- unstable
- external
- location-dependent
- impossible to fully control

This is useful for:

- sound installations
- long-duration generative pieces
- weather-reactive performances
- remote-location artworks
- pedagogical projects around OSC, Max, and sonification

## Features

- Live weather fetch from OpenWeather
- OSC output via `node-osc`
- Ready-to-use values for music and sonification
- Stable ordered OSC output lists
- Support for raw API values and derived musical values
- Max/MSP patch included in the repository

## Repository Contents

- `weather-to-max.js`
  Minimal weather fetch test.
- `weather-osc-V1.js`
  Early OSC version.
- `weather-to-max-to-osc.js`
  Main weather-to-OSC script.
- `weather-to-max-to-osc2.js`
  Fixed-order OSC output version with explicit message list.
- `weather-to-max-to-osc3.js`
  Alternate working version in the repository.
- `weather-to-max-to-osc4.js`
  Extended version with ordered output logging in the console.
- `weather-extreme.js`
  Utility for scanning or experimenting with extreme conditions.
- `weather-to-max-osc.maxpat`
  Max/MSP patch for OSC reception.
- `WEATHER_API_OSC.csv`
  OSC field reference.

## Requirements

- Node.js 18 or newer
- Max/MSP
- An OpenWeather API key

## Installation

Clone the repository and install dependencies:

```bash
npm install
```

Create a `.env` file in the project root:

```env
API_CODE=your_openweathermap_api_key
```

## Quick Start

Run one of the weather scripts:

```bash
node weather-to-max-to-osc4.js
```

In Max/MSP, receive OSC on port `7400`:

```text
udpreceive 7400
```

By default, the scripts send to:

- host: `127.0.0.1`
- port: `7400`

## Main Parameters

In the scripts, you can quickly adjust:

- `CITY`
- `OSC_IP`
- `OSC_PORT`
- `REFRESH_EVERY_MS`

Example:

```js
const CITY = 'Paris';
const OSC_IP = '127.0.0.1';
const OSC_PORT = 7400;
const REFRESH_EVERY_MS = 1 * 10 * 1000;
```

## OSC Output

The project can send both:

- raw weather fields from the OpenWeather response
- derived values designed for direct musical use

Examples of musical outputs:

```text
/weather/api/temp
/weather/api/humidity
/weather/api/wind
/weather/api/main
/weather/api/mainCode
/weather/api/sunrise_norm
/weather/api/sunset_norm
/weather/api/day_length_norm
/weather/api/day_progress
/weather/api/isDay
```

Examples of raw API outputs:

```text
/weather/api/coord/lon
/weather/api/coord/lat
/weather/api/weather/0/id
/weather/api/weather/0/main
/weather/api/weather/0/description
/weather/api/main/temp
/weather/api/main/feels_like
/weather/api/wind/speed
/weather/api/wind/deg
/weather/api/sys/sunrise
/weather/api/sys/sunset
/weather/api/timezone
```

## Fixed Ordered Output

The recent script versions are designed to keep a fixed OSC output order.

That matters because:

- some weather fields are optional
- some cities return different subsets of data
- Max patches are easier to maintain when output positions stay consistent

Missing values are replaced with fallback values such as:

- `-9999` for missing numbers
- `""` for missing strings
- `-1` for some derived state values

## Weather Condition Codes

Weather conditions are also mapped to integer codes for easier structural control:

| Code | Condition |
|---:|---|
| 0 | Clear |
| 1 | Clouds |
| 2 | Rain |
| 3 | Drizzle |
| 4 | Thunderstorm |
| 5 | Snow |
| 6 | Mist |
| 7 | Fog |
| 8 | Smoke |
| 9 | Haze |
| 10 | Dust |
| 11 | Sand |
| 12 | Ash |
| 13 | Squall |
| 14 | Tornado |
| -1 | Unknown / unmapped |

Possible artistic uses:

- scene switching
- algorithm selection
- changing synthesis mode
- large-scale formal transformations

## Musical Interpretation Ideas

Some direct mappings you can try in Max/MSP:

- temperature -> pitch range or filter cutoff
- humidity -> reverb amount or spectral blur
- wind speed -> modulation depth or noise density
- day length -> piece duration scaling or harmonic openness
- sunrise/sunset -> section boundaries
- weather code -> structural state machine

The most interesting results often come from indirect mappings rather than literal one-to-one control.

## Console Logging

Some script versions also print:

- the received weather summary
- the number of OSC outputs sent
- the ordered list of OSC outputs with their values

This is useful for debugging Max patches and checking output consistency across cities.

## Suggested Workflow

1. Start with `weather-to-max.js` to verify API access.
2. Use `weather-to-max-to-osc2.js` or `weather-to-max-to-osc4.js` for stable ordered OSC output.
3. Open `weather-to-max-osc.maxpat` in Max/MSP.
4. Build your own mapping layer on top of the incoming weather values.

## Notes

- OpenWeather responses vary depending on location and current conditions.
- Rain, snow, gust, sea level, and ground level fields may be absent.
- OSC is sent over UDP, so transport behavior should be considered when building performance-critical systems.

## Development

Install dependencies:

```bash
npm install
```

Run a script:

```bash
node weather-to-max-to-osc2.js
```

Commit changes:

```bash
git add .
git commit -m "Update weather scripts"
git push
```

## License

MIT

If you build an installation, performance, or artwork with this project, I would be very interested in seeing or hearing the result.
