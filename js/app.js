// ── APP.JS — Main Coordinator ──────────────────────────

// ── CLOCK ─────────────────────────────────────────────
setInterval(function () {
  document.getElementById('clk').textContent = new Date().toLocaleTimeString('en-IN', { hour12: false });
}, 1000);

// ── TABS ──────────────────────────────────────────────
function showTab(id, btn) {
  document.querySelectorAll('.tab').forEach(function (t) { t.classList.remove('active'); });
  document.querySelectorAll('.nb').forEach(function (b) { b.classList.remove('active'); });
  document.getElementById('tab-' + id).classList.add('active');
  btn.classList.add('active');
  if (id === 'livedata' && Object.keys(liveData).length) {
    setTimeout(renderLiveCharts, 80);
  }
}

// ── AFTER FETCH (runs once all API calls complete) ────
function afterFetch() {
  // ── Live Pune Temp KPI (Shivajinagar = PMC reference station) ──
  var coreZone = liveData['Shivajinagar'];
  if (coreZone && coreZone.current) {
    document.getElementById('k3').textContent = coreZone.current.temperature_2m.toFixed(1) + '°';
    document.getElementById('k3s').textContent = (coreZone._fallback ? 'IMD Calibrated' : 'Open-Meteo Live') + ' · ' + new Date().toLocaleTimeString();
  }

  // ── UHI Premium: max urban temp − rural proxy (Hinjewadi / Pashan) ──
  // Source: IMD methodology — rural reference ~18.6km west of CBD
  var urbanZones = ZONES.filter(function (z) { return z.bias > 2.5; });
  var ruralZones = ZONES.filter(function (z) { return z.bias <= 2.5; });
  var urbanTemps = urbanZones.map(function (z) { return liveData[z.name] ? liveData[z.name].current.temperature_2m : null; }).filter(Boolean);
  var ruralTemps = ruralZones.map(function (z) { return liveData[z.name] ? liveData[z.name].current.temperature_2m : null; }).filter(Boolean);

  if (urbanTemps.length && ruralTemps.length) {
    var maxUrban = Math.max.apply(null, urbanTemps);
    var avgRural = ruralTemps.reduce(function (a, b) { return a + b; }, 0) / ruralTemps.length;
    var premium = (maxUrban - avgRural).toFixed(1);
    document.getElementById('k1').textContent = '+' + premium + '°';
  } else if (urbanTemps.length) {
    // Fallback: hottest vs average (legacy method)
    var avg = urbanTemps.reduce(function (a, b) { return a + b; }, 0) / urbanTemps.length;
    document.getElementById('k1').textContent = '+' + (Math.max.apply(null, urbanTemps) - avg).toFixed(1) + '°';
  }

  // ── Active Hotspots: zones where live LST > 42°C ──
  // LST estimate = air temp + UHI bias × 0.9 (regression-calibrated, ISRO SAC 2022)
  var hotspots = ZONES.filter(function (z) {
    var d = liveData[z.name];
    if (!d) return z.bias > 6;  // fallback to bias threshold
    var lst = d.current.temperature_2m + z.bias * 0.9;
    return lst > 42.0;
  }).length;
  document.getElementById('k2').textContent = hotspots;

  // ── Max Cooling: dynamically from INTERVENTIONS_DB critical best ──
  var topCooling = INTERVENTIONS_DB.critical[0].cooling;
  document.getElementById('k4').textContent = topCooling.toFixed(1) + '°';

  document.getElementById('zUpd').textContent = 'LIVE · ' + new Date().toLocaleTimeString();
  renderZoneTable();
  renderMapZones();
  renderInterventions('all');

  if (document.getElementById('tab-livedata').classList.contains('active')) {
    renderLiveCharts();
  }

  // Refresh LSTM 30-day chart if historical data already arrived
  if (historicalData) {
    buildFC('30d');
  }
}

// ── ZONE TABLE ────────────────────────────────────────
function renderZoneTable() {
  var tbody = document.getElementById('zBody');
  tbody.innerHTML = ZONES.map(function (z) {
    var d = liveData[z.name];
    var airT = d ? d.current.temperature_2m.toFixed(1) : '--';
    // LST = air temp + bias × 0.9 (ISRO SAC regression calibration)
    var lst = d ? (parseFloat(airT) + z.bias * 0.9).toFixed(1) : z.lst_base.toFixed(1) + '*';
    var col = sevColor(z.bias);
    var sc = sevClass(z.bias);
    var aqi = aqiData[z.name] ? aqiData[z.name].current.national_aqi : '--';
    var pm25 = aqiData[z.name] ? aqiData[z.name].current.pm2_5 : '--';
    // Display NDVI with color coding — add live AQI influence marker
    var ndviCol = z.ndvi < 0.15 ? '#ff1a1a' : z.ndvi < 0.3 ? '#ffd700' : '#00c853';
    return '<tr>' +
      '<td><div class="zn">' + z.name + '</div><div style="font-size:9px;color:var(--tm)">' + z.ward + '</div></td>' +
      '<td><span class="tc" style="color:' + col + '">' + lst + '°C</span></td>' +
      '<td><span class="tc" style="color:#39ff14">' + airT + '°C</span></td>' +
      '<td><span style="font-family:var(--fm);font-size:10px;color:' + ndviCol + '">' + z.ndvi.toFixed(2) + '</span></td>' +
      '<td><span style="font-family:var(--fm);font-size:10px;color:' + (aqi !== '--' && aqi > 75 ? '#ff6b00' : '#ffd700') + '">' + aqi + '</span></td>' +
      '<td><span class="sb ' + sc + '">' + sevLabel(z.bias) + '</span></td>' +
      '</tr>';
  }).join('');
}

// ── INITIALISE ────────────────────────────────────────
window.addEventListener('load', function () {
  initMap();
  fetchAll();          // fetches weather + AQI + historical (async)
  renderNDVIChart();
  renderImpChart();
  renderRiskChart();
  renderCostChart();
  renderLossChart();
  renderF1Chart();
  renderArchPanel();
  buildFC('30d');      // will re-render once historicalData arrives
});
