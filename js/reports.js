// ── REPORTS MODULE ─────────────────────────────────────

function generateReport() {
  var zoneSelect = document.getElementById('rptZone').value;
  var output     = document.getElementById('reportOutput');
  var cards      = document.getElementById('reportCards');

  var zones = zoneSelect === 'all'
    ? ZONES
    : ZONES.filter(function(z) { return z.name === zoneSelect; });

  output.innerHTML = '<span class="spin"></span> Generating report…';

  setTimeout(function() {
    output.innerHTML = '✓ Report generated for ' + zones.length + ' zone(s) on ' + new Date().toLocaleString('en-IN');
    cards.innerHTML = '';
    zones.forEach(function(z) { cards.appendChild(buildReportCard(z)); });
  }, 600);
}

function buildReportCard(z) {
  var d    = liveData[z.name];
  var airT = d ? d.current.temperature_2m.toFixed(1) : 'N/A';
  var hum  = d ? d.current.relative_humidity_2m : 'N/A';
  var wind = d ? d.current.wind_speed_10m : 'N/A';
  var lst  = d ? (parseFloat(airT) + z.bias * 0.9).toFixed(1) : 'N/A';
  var aqi  = aqiData[z.name] ? aqiData[z.name].current.national_aqi : 'N/A';
  var pm25 = aqiData[z.name] ? aqiData[z.name].current.pm2_5 : 'N/A';

  var interventions = getInterventionsForZone(z.name);
  var top3 = interventions.slice(0, 3);
  var riskLevel = sevLabel(z.bias);
  var col = sevColor(z.bias);

  var card = document.createElement('div');
  card.className = 'rpt-card';
  card.id = 'rpt-' + z.name.replace(/\s+/g, '-');

  var intList = top3.map(function(item, i) {
    return '<li style="margin-bottom:4px"><strong>' + item.name + '</strong> — ' +
      item.desc + ' | Cooling: −' + item.cooling + '°C | Cost: ₹' + item.cost + 'L/km² | ' + item.timeframe + '</li>';
  }).join('');

  card.innerHTML =
    '<h3>📍 ' + z.name + ' — Mitigation Report <span style="font-size:11px;color:' + col + '">(' + riskLevel + ')</span></h3>' +
    '<div class="rpt-meta">Generated: ' + new Date().toLocaleString('en-IN') + ' · Ward: ' + z.ward + ' · Open-Meteo Live Data</div>' +

    '<div class="rpt-body">' +
      '<strong style="color:var(--ac)">📊 Current Conditions:</strong><br>' +
      'Air Temperature: ' + airT + '°C &nbsp;|&nbsp; ' +
      'Est. LST: ' + lst + '°C &nbsp;|&nbsp; ' +
      'Humidity: ' + hum + '% &nbsp;|&nbsp; ' +
      'Wind: ' + wind + ' km/h<br>' +
      'NDVI: ' + z.ndvi + ' &nbsp;|&nbsp; UHI Bias: +' + z.bias + '°C &nbsp;|&nbsp; Impervious: ' + z.impervious + '%<br>' +
      'AQI (National/CPCB): ' + aqi + ' &nbsp;|&nbsp; PM2.5: ' + pm25 + ' µg/m³<br>' +
      'Population Density: ~' + z.pop_density.toLocaleString() + ' persons/km²<br><br>' +

      '<strong style="color:var(--ac)">🌿 Top Recommended Interventions:</strong>' +
      '<ol style="margin:6px 0 0 16px">' + intList + '</ol><br>' +

      '<strong style="color:var(--ac)">🎯 SDG Alignment:</strong> ' + top3.map(function(i){return i.sdg;}).join(', ') + '<br>' +
      '<strong style="color:var(--ac)">💰 Total Budget Estimate:</strong> ₹' + top3.reduce(function(s,i){return s+i.cost;},0).toFixed(1) + 'L/km²<br>' +
      '<strong style="color:var(--ac)">🌡 Max Cooling Achievable:</strong> −' + top3.reduce(function(s,i){return s+i.cooling;},0).toFixed(1) + '°C (combined)<br>' +
    '</div>' +

    '<div class="rpt-actions">' +
      '<button onclick="printZoneReport(\'' + z.name + '\')" style="background:rgba(0,229,255,.15);border:1px solid var(--ac);color:var(--ac)">🖨 Print</button>' +
      '<button onclick="downloadZoneCSV(\'' + z.name + '\')" style="background:rgba(57,255,20,.1);border:1px solid rgba(57,255,20,.3);color:var(--ac3)">📊 CSV</button>' +
    '</div>';

  return card;
}

// ── PRINT REPORT ──────────────────────────────────────
function printReport() {
  window.print();
}

function printZoneReport(zoneName) {
  // Scroll to card and print
  var el = document.getElementById('rpt-' + zoneName.replace(/\s+/g, '-'));
  if (el) el.scrollIntoView({ behavior: 'smooth' });
  setTimeout(function() { window.print(); }, 400);
}

// ── CSV EXPORT ────────────────────────────────────────
function downloadCSV() {
  var rows = [['Zone','Ward','Risk','Air Temp (°C)','Est LST (°C)','NDVI','UHI Bias','Impervious %','AQI','PM2.5','Top Intervention','Cooling (°C)','Cost (₹L/km²)','Timeframe','SDG']];
  ZONES.forEach(function(z) {
    var d    = liveData[z.name];
    var airT = d ? d.current.temperature_2m.toFixed(1) : '';
    var lst  = d ? (parseFloat(airT) + z.bias * 0.9).toFixed(1) : '';
    var aqi  = aqiData[z.name] ? aqiData[z.name].current.national_aqi : '';
    var pm25 = aqiData[z.name] ? aqiData[z.name].current.pm2_5 : '';
    var top  = getInterventionsForZone(z.name)[0];
    rows.push([z.name, z.ward, sevLabel(z.bias), airT, lst, z.ndvi, z.bias, z.impervious, aqi, pm25, top.name, top.cooling, top.cost, top.timeframe, top.sdg]);
  });
  var csv = rows.map(function(r) { return r.map(function(c) { return '"' + c + '"'; }).join(','); }).join('\n');
  var blob = new Blob([csv], { type: 'text/csv' });
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement('a');
  a.href   = url;
  a.download = 'UHI_Mitigation_Report_Pune_' + new Date().toISOString().split('T')[0] + '.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function downloadZoneCSV(zoneName) {
  var z    = ZONES.find(function(z) { return z.name === zoneName; });
  if (!z)  return;
  var d    = liveData[z.name];
  var rows = [['Parameter','Value']];
  var airT = d ? d.current.temperature_2m.toFixed(1) : 'N/A';
  rows.push(['Zone', z.name],['Ward', z.ward],['Risk Level', sevLabel(z.bias)],['Air Temp (°C)', airT],['Est LST (°C)', d ? (parseFloat(airT)+z.bias*0.9).toFixed(1) : 'N/A'],['NDVI', z.ndvi],['UHI Bias (°C)', z.bias],['Impervious (%)', z.impervious],['Pop. Density (/km²)', z.pop_density]);
  var csv  = rows.map(function(r) { return '"' + r[0] + '","' + r[1] + '"'; }).join('\n');
  var blob = new Blob([csv], { type: 'text/csv' });
  var a    = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = 'UHI_' + z.name.replace(/\s+/g,'-') + '.csv'; a.click();
}

// ── DOWNLOAD REPORT (from prescribe tab) ─────────────
function downloadReport() {
  var zone = document.getElementById('regionFilter').value;
  document.getElementById('rptZone').value = zone;
  showTab('report', document.querySelectorAll('.nb')[5]);
  setTimeout(generateReport, 200);
}
