// ── MAP MODULE ─────────────────────────────────────────
var puneMap, mapMarkers = [], heatLayer = null;

function sevColor(bias) {
  return bias > 7 ? '#ff1a1a' : bias > 5.5 ? '#ff6b00' : bias > 3.5 ? '#ffd700' : '#00c853';
}
function sevLabel(bias) {
  return bias > 7 ? 'CRITICAL' : bias > 5.5 ? 'HIGH' : bias > 3.5 ? 'MEDIUM' : 'LOW';
}
function sevClass(bias) {
  return bias > 7 ? 'sc' : bias > 5.5 ? 'sh' : bias > 3.5 ? 'sm' : 'sl';
}

function initMap() {
  puneMap = L.map('puneMap', {
    center: [18.52, 73.855],
    zoom: 12,
    zoomControl: true,
    attributionControl: false
  });

  // CartoDB Dark Matter — free, no API key
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    subdomains: 'abcd', maxZoom: 19
  }).addTo(puneMap);

  L.control.attribution({ prefix: false })
    .addAttribution('Map © OpenStreetMap · CartoDB')
    .addTo(puneMap);

  renderMapZones();
}

function renderMapZones() {
  mapMarkers.forEach(function(m) { puneMap.removeLayer(m); });
  mapMarkers = [];

  // Heat radius circles
  ZONES.forEach(function(z) {
    var intensity = Math.min(1, z.bias / 8.5);
    var col = sevColor(z.bias);
    var radius = 1800 + intensity * 1400;

    var circle = L.circle([z.lat, z.lon], {
      radius: radius,
      color: 'transparent',
      fillColor: col,
      fillOpacity: 0.18 + intensity * 0.20,
      weight: 0
    }).addTo(puneMap);
    mapMarkers.push(circle);
  });

  // Markers + Popups
  ZONES.forEach(function(z) {
    var col  = sevColor(z.bias);
    var d    = liveData[z.name];
    var airT = d ? d.current.temperature_2m.toFixed(1) : '--';
    var lst  = d
      ? (parseFloat(airT) + z.bias * 0.9).toFixed(1)
      : (28 + z.bias * 0.8 + z.bias * 0.9).toFixed(1);
    var aqi  = aqiData[z.name] ? aqiData[z.name].current.national_aqi : '--';
    var hum  = d ? d.current.relative_humidity_2m + '%' : '--';
    var wind = d ? d.current.wind_speed_10m + ' km/h' : '--';

    var icon = L.divIcon({
      className: '',
      html: '<div style="width:13px;height:13px;border-radius:50%;background:' + col +
        ';border:2px solid rgba(255,255,255,.85);box-shadow:0 0 8px ' + col + ';"></div>',
      iconSize: [13, 13], iconAnchor: [6, 6]
    });

    var popup =
      '<div style="font-family:Syne,sans-serif;font-weight:800;font-size:14px;color:#00e5ff;margin-bottom:7px">' + z.name + '</div>' +
      '<div style="line-height:2;">' +
      '🌡 Est. LST: <span style="color:' + col + ';font-weight:600">' + lst + '°C</span><br>' +
      '🌤 Air Temp: <span style="color:#39ff14">' + airT + '°C</span><br>' +
      '💧 Humidity: <span style="color:#00bcd4">' + hum + '</span><br>' +
      '💨 Wind: <span style="color:#9c27b0">' + wind + '</span><br>' +
      '🌿 NDVI: <span style="color:#00c853">' + z.ndvi + '</span><br>' +
      '🏭 AQI: <span style="color:' + (aqi !== '--' && aqi > 200 ? '#ff6b00' : '#ffd700') + '">' + aqi + '</span><br>' +
      '⚠ Severity: <span style="color:' + col + '">' + sevLabel(z.bias) + '</span>' +
      '</div>';

    var marker = L.marker([z.lat, z.lon], { icon: icon }).addTo(puneMap);
    marker.bindPopup(popup, { maxWidth: 220 });
    mapMarkers.push(marker);
  });

  // Legend
  if (!document.getElementById('mapLegend')) {
    var legend = L.control({ position: 'bottomright' });
    legend.onAdd = function() {
      var div = L.DomUtil.create('div');
      div.id = 'mapLegend';
      div.style.cssText = 'background:#111827;border:1px solid #1e2d45;border-radius:8px;padding:10px 14px;font-family:IBM Plex Mono,monospace;font-size:10px;color:#6b84a3;line-height:2';
      div.innerHTML =
        '<div style="color:#00e5ff;font-weight:700;margin-bottom:4px;font-family:Syne,sans-serif;font-size:11px">LST SCALE</div>' +
        '<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:#ff1a1a;margin-right:5px"></span>Critical &gt;41°C<br>' +
        '<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:#ff6b00;margin-right:5px"></span>High 38–41°C<br>' +
        '<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:#ffd700;margin-right:5px"></span>Medium 35–38°C<br>' +
        '<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:#00c853;margin-right:5px"></span>Low &lt;35°C';
      return div;
    };
    legend.addTo(puneMap);
  }
}
