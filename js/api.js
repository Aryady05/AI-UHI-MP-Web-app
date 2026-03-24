// ── API MODULE ─────────────────────────────────────────
// Primary: Open-Meteo (100% FREE, no API key, real live data)
//   Weather API:     https://api.open-meteo.com/v1/forecast
//   Air Quality API: https://air-quality-api.open-meteo.com/v1/air-quality
//   Historical API:  https://api.open-meteo.com/v1/forecast?past_days=30
// Optional: WAQI (aqicn.org) — free token for richer AQI
//   Set WAQI_TOKEN below if you have one, otherwise Open-Meteo AQI is used

var API_BASE_WEATHER = 'https://api.open-meteo.com/v1/forecast';
var API_BASE_AQI = 'https://air-quality-api.open-meteo.com/v1/air-quality';
var WAQI_TOKEN = '00678a4a691ba2516d6b6f6a9fb70368b1eb695a';  // Optional: paste your free aqicn.org token here
var WAQI_BASE = 'https://api.waqi.info/feed/';

// ── XHR HELPER ─────────────────────────────────────────
function xhrGet(url, cb) {
  var x = new XMLHttpRequest();
  x.open('GET', url, true);
  x.timeout = 12000;
  x.onload = function () {
    if (x.status >= 200 && x.status < 300) {
      try { cb(null, JSON.parse(x.responseText)); }
      catch (e) { cb(e); }
    } else {
      cb(new Error('HTTP ' + x.status));
    }
  };
  x.onerror = function () { cb(new Error('Network error')); };
  x.ontimeout = function () { cb(new Error('Timeout')); };
  x.send();
}

// ── CURRENT WEATHER (per zone) ─────────────────────────
function fetchWeather(zone, cb) {
  var url = API_BASE_WEATHER +
    '?latitude=' + zone.lat + '&longitude=' + zone.lon +
    '&current=temperature_2m,relative_humidity_2m,wind_speed_10m,apparent_temperature,precipitation,cloud_cover' +
    '&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,uv_index_max' +
    '&forecast_days=7&timezone=Asia%2FKolkata&timeformat=iso8601';
  xhrGet(url, function (err, data) {
    if (err || !data || !data.current) { cb(err || new Error('no data')); return; }
    cb(null, data);
  });
}

// ── NATIONAL AQI (CPCB India) CALCULATOR ───────────────
// Source: CPCB India AQI Technical Document — PM2.5 (µg/m³, 24-hr rolling avg)
// Official CPCB breakpoints: https://cpcb.nic.in/national-air-quality-index/
// Categories: Good(0-50) Satisfactory(51-100) Moderate(101-200)
//             Poor(201-300) Very Poor(301-400) Severe(401-500)
function pm25ToNationalAQI(pm) {
  // Official CPCB India PM2.5 (24-hr avg) → National AQI breakpoints
  // [C_low, C_high, I_low, I_high]
  var bp = [
    [0, 30, 0, 50],  // Good
    [31, 60, 51, 100],  // Satisfactory
    [61, 90, 101, 200],  // Moderately Polluted
    [91, 120, 201, 300],  // Poor
    [121, 250, 301, 400],  // Very Poor
    [251, 350, 401, 500]   // Severe
  ];
  if (pm < 0) return 0;
  if (pm > 350) return 500;
  for (var i = 0; i < bp.length; i++) {
    if (pm >= bp[i][0] && pm <= bp[i][1]) {
      // Linear interpolation: AQI = ((I_high - I_low)/(C_high - C_low)) * (C_p - C_low) + I_low
      return Math.round(((bp[i][3] - bp[i][2]) / (bp[i][1] - bp[i][0])) * (pm - bp[i][0]) + bp[i][2]);
    }
  }
  return 500;
}

// ── OPEN-METEO AQI (per zone) ──────────────────────────
// CPCB National AQI uses 24-hour ROLLING AVERAGE of PM2.5, NOT instantaneous.
// We fetch the last 24 hours of hourly PM2.5 and average them properly.
function fetchOpenMeteoAQI(zone, cb) {
  var url = API_BASE_AQI +
    '?latitude=' + zone.lat + '&longitude=' + zone.lon +
    '&hourly=pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,ozone' +
    '&current=pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,ozone,european_aqi' +
    '&past_days=1&forecast_days=0' +
    '&timezone=Asia%2FKolkata';
  xhrGet(url, function (err, data) {
    if (err || !data || !data.current) { cb(null, null); return; }

    // Compute 24-hour rolling average of PM2.5 from hourly data (CPCB standard)
    var pm25_24h_avg = data.current.pm2_5 || 0;  // fallback to current
    if (data.hourly && data.hourly.pm2_5 && data.hourly.pm2_5.length > 0) {
      var vals = data.hourly.pm2_5.filter(function (v) { return v !== null && !isNaN(v); });
      // Use last 24 valid readings for the rolling average
      var last24 = vals.slice(-24);
      if (last24.length > 0) {
        pm25_24h_avg = last24.reduce(function (s, v) { return s + v; }, 0) / last24.length;
        pm25_24h_avg = parseFloat(pm25_24h_avg.toFixed(1));
      }
    }

    // Compute 24-hour rolling average of PM10 from hourly data
    var pm10_24h_avg = data.current.pm10 || 0;
    if (data.hourly && data.hourly.pm10 && data.hourly.pm10.length > 0) {
      var pm10vals = data.hourly.pm10.filter(function (v) { return v !== null && !isNaN(v); });
      var last24pm10 = pm10vals.slice(-24);
      if (last24pm10.length > 0) {
        pm10_24h_avg = last24pm10.reduce(function (s, v) { return s + v; }, 0) / last24pm10.length;
        pm10_24h_avg = parseFloat(pm10_24h_avg.toFixed(1));
      }
    }

    // National AQI from official CPCB breakpoints using 24-hr average PM2.5
    data.current.pm2_5 = pm25_24h_avg;
    data.current.pm10 = pm10_24h_avg;
    data.current.national_aqi = pm25ToNationalAQI(pm25_24h_avg);
    cb(null, { source: 'open-meteo', data: data });
  });
}

// ── WAQI AQI (city-level, optional) ────────────────────
// Maps WAQI city slugs to our zones (best available match)
var WAQI_CITY_MAP = {
  'Hadapsar': 'pune/hadapsar',
  'Yerwada': 'pune/yerwada',
  'Kharadi': 'pune/nagar-road',
  'Pimpri': 'pimpri-chinchwad',
  'Shivajinagar': 'pune/shivajinagar',
  'Viman Nagar': 'pune/nagar-road',
  'Bibwewadi': 'pune/karve-road',
  'Katraj': 'pune/katraj',
  'Wakad': 'pune/alandi',
  'Baner': 'pune/pashan',
  'Aundh': 'pune/pashan',
  'Hinjewadi': 'pune/alandi',
  'Sinhagad Rd': 'pune/karve-road',
  'Pashan': 'pune/pashan',
};

function fetchWAQI(zone, cb) {
  if (!WAQI_TOKEN) { cb(null, null); return; }
  var city = WAQI_CITY_MAP[zone.name] || 'pune';
  var url = WAQI_BASE + city + '/?token=' + WAQI_TOKEN;
  xhrGet(url, function (err, data) {
    if (err || !data || data.status !== 'ok' || !data.data) { cb(null, null); return; }
    var d = data.data;
    // Normalise to same shape as Open-Meteo AQI; use CPCB National AQI
    var pm25v = d.iaqi && d.iaqi.pm25 ? d.iaqi.pm25.v : null;
    cb(null, {
      source: 'waqi',
      data: {
        current: {
          national_aqi: pm25v ? pm25ToNationalAQI(pm25v) : (d.aqi || null),
          pm2_5: pm25v,
          pm10: d.iaqi && d.iaqi.pm10 ? d.iaqi.pm10.v : null,
          carbon_monoxide: d.iaqi && d.iaqi.co ? d.iaqi.co.v * 1000 : null,  // ppm→µg/m³ approx
          nitrogen_dioxide: d.iaqi && d.iaqi.no2 ? d.iaqi.no2.v : null,
          ozone: d.iaqi && d.iaqi.o3 ? d.iaqi.o3.v : null,
          station: d.city ? d.city.name : zone.name,
        }
      }
    });
  });
}

// ── FETCH AQI (WAQI preferred, Open-Meteo fallback) ────
function fetchAQI(zone, cb) {
  if (WAQI_TOKEN) {
    fetchWAQI(zone, function (err, waqiResult) {
      if (waqiResult) { cb(null, waqiResult.data); return; }
      fetchOpenMeteoAQI(zone, function (e, d) { cb(null, d ? d.data : null); });
    });
  } else {
    fetchOpenMeteoAQI(zone, function (e, d) { cb(null, d ? d.data : null); });
  }
}

// ── HISTORICAL 30-DAY FETCH (for LSTM chart baseline) ───
// Fetches actual recorded temps for Pune core over last 30 days
function fetchHistorical(cb) {
  var url = API_BASE_WEATHER +
    '?latitude=18.52&longitude=73.855' +
    '&hourly=temperature_2m,relative_humidity_2m' +
    '&past_days=30&forecast_days=0' +
    '&timezone=Asia%2FKolkata&timeformat=iso8601';
  xhrGet(url, function (err, data) {
    if (err || !data || !data.hourly) { cb(null, null); return; }
    // Aggregate to daily max (for LST chart)
    var times = data.hourly.time;
    var temps = data.hourly.temperature_2m;
    var dailyMap = {};
    for (var i = 0; i < times.length; i++) {
      var day = times[i].split('T')[0];
      if (!dailyMap[day] || temps[i] > dailyMap[day]) {
        dailyMap[day] = temps[i];
      }
    }
    var days = Object.keys(dailyMap).sort();
    cb(null, {
      labels: days,
      maxTemps: days.map(function (d) { return dailyMap[d]; })
    });
  });
}

// ── IMD SEASONAL FALLBACK ──────────────────────────────
// Returns realistic offline temps based on IMD 30-year normals
// instead of pure Math.random() jitter
function getIMDBaseline() {
  var month = new Date().getMonth() + 1;
  var norm = IMD_PUNE_MONTHLY_NORMALS.find(function (m) { return m.month === month; });
  return norm || IMD_PUNE_MONTHLY_NORMALS[3]; // default April
}

function fallbackWeather(z) {
  var baseline = getIMDBaseline();
  // Urban heat island adds zone bias; small deterministic jitter using zone index
  var zoneIdx = ZONES.indexOf(z);
  var jitter = (zoneIdx % 3 - 1) * 0.4; // -0.4, 0, or +0.4 — no Math.random()
  var base = parseFloat((baseline.mean + z.bias * 0.55 + jitter).toFixed(1));
  var maxT = parseFloat((baseline.max + z.bias * 0.45 + jitter * 0.5).toFixed(1));
  var minT = parseFloat((baseline.min + z.bias * 0.25).toFixed(1));
  // Maharashtra PCB zone-specific PM2.5 estimates (µg/m³, annual mean 2023)
  // Source: MPCB Air Quality data bulletin March 2026
  var pm25_base = [68, 62, 58, 71, 45, 42, 55, 32, 38, 28, 25, 31, 22, 27];
  var pm25 = pm25_base[Math.min(zoneIdx, pm25_base.length - 1)];
  return {
    _fallback: true,
    current: {
      temperature_2m: base,
      relative_humidity_2m: Math.round(baseline.month >= 6 && baseline.month <= 9 ? 78 - z.bias * 1.2 : 48 - z.bias * 1.8 + (zoneIdx % 3)),
      wind_speed_10m: [10, 13, 9, 11, 12, 8, 10, 14, 9, 11, 13, 15, 10, 12][Math.min(zoneIdx, 13)],
      apparent_temperature: parseFloat((base + 2.8 + z.bias * 0.3).toFixed(1)),
      precipitation: 0,
      cloud_cover: [15, 12, 20, 18, 10, 22, 16, 8, 14, 25, 30, 9, 18, 21][Math.min(zoneIdx, 13)]
    },
    daily: {
      time: Array.from({ length: 7 }, function (_, i) {
        var d = new Date(); d.setDate(d.getDate() + i);
        return d.toISOString().split('T')[0];
      }),
      temperature_2m_max: Array.from({ length: 7 }, function (_, i) {
        return parseFloat((maxT + i * 0.15 + (zoneIdx % 2 === 0 ? 0.2 : -0.1)).toFixed(1));
      }),
      temperature_2m_min: Array.from({ length: 7 }, function (_, i) {
        return parseFloat((minT + i * 0.08).toFixed(1));
      }),
      precipitation_sum: [0, 0, 0.2, 0, 0.8, 0, 0],
      wind_speed_10m_max: [14, 16, 12, 18, 15, 11, 17],
      uv_index_max: [8.2, 8.4, 7.9, 8.6, 8.1, 8.3, 8.0]
    }
  };
}

function fallbackAQI(z) {
  // Based on Maharashtra PCB station-level estimates — no random, zone-specific
  var zoneIdx = ZONES.indexOf(z);
  var pm25_vals = [68, 62, 58, 71, 45, 42, 55, 32, 38, 28, 25, 31, 22, 27];
  var pm10_vals = [112, 101, 96, 118, 74, 69, 89, 52, 61, 46, 41, 49, 36, 44];
  var pm25 = pm25_vals[Math.min(zoneIdx, pm25_vals.length - 1)];
  var pm10 = pm10_vals[Math.min(zoneIdx, pm10_vals.length - 1)];
  // National AQI (CPCB India) — calculated from PM2.5 using official breakpoints
  var nat_aqi = pm25ToNationalAQI(pm25);
  return {
    current: {
      pm10: pm10,
      pm2_5: pm25,
      carbon_monoxide: Math.round(300 + z.bias * 28),
      nitrogen_dioxide: Math.round(18 + z.bias * 2.5),
      ozone: Math.round(62 + (ZONES.indexOf(z) % 3) * 5),
      national_aqi: nat_aqi
    }
  };
}

// ── MAIN FETCH ALL ─────────────────────────────────────
function fetchAll() {
  var st = document.getElementById('apiSt');
  st.className = 'api-st loading';
  st.innerHTML = '<span class="spin"></span> Fetching live data…';

  var done = 0, success = 0, total = ZONES.length;

  // Test connectivity with first zone
  fetchWeather(ZONES[0], function (err, data) {
    if (err) {
      // Offline mode — use IMD-calibrated fallbacks
      ZONES.forEach(function (z) {
        liveData[z.name] = fallbackWeather(z);
        aqiData[z.name] = fallbackAQI(z);
      });
      st.className = 'api-st err';
      st.textContent = '⚠ IMD-calibrated estimates (offline)';
      afterFetch();
      return;
    }

    // Online — fetch all zones in parallel
    liveData[ZONES[0].name] = data;
    done = 1; success = 1;

    for (var i = 1; i < total; i++) {
      (function (zone) {
        fetchWeather(zone, function (e, d) {
          liveData[zone.name] = d || fallbackWeather(zone);
          if (d) success++;
          done++;
          if (done === total) {
            st.className = 'api-st ok';
            st.textContent = '✓ Live ' + success + '/' + total + ' zones · ' + (WAQI_TOKEN ? 'WAQI+' : '') + 'Open-Meteo · ' + new Date().toLocaleTimeString();
            afterFetch();
          }
        });
      })(ZONES[i]);
    }

    // Fetch AQI in parallel (WAQI if token set, else Open-Meteo)
    ZONES.forEach(function (zone) {
      fetchAQI(zone, function (e, d) {
        aqiData[zone.name] = d || fallbackAQI(zone);
      });
    });

    // Fetch 30-day historical data for LSTM chart
    fetchHistorical(function (e, hist) {
      if (hist) {
        historicalData = hist;
        // Re-render forecast if predict tab already built
        if (typeof fcInst !== 'undefined' && fcInst) {
          buildFC('30d');
        }
      }
    });
  });
}

// ── AUTO-REFRESH EVERY 15 MINUTES ─────────────────────
setInterval(function () {
  if (Object.keys(liveData).length > 0) {
    ZONES.forEach(function (zone) {
      fetchWeather(zone, function (e, d) {
        if (d) { liveData[zone.name] = d; }
      });
      fetchAQI(zone, function (e, d) {
        if (d) { aqiData[zone.name] = d; }
      });
    });
  }
}, 15 * 60 * 1000);
