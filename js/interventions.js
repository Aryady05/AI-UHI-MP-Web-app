// ── INTERVENTIONS MODULE ───────────────────────────────

var RANK_CLASSES = ['r1','r2','r3','r4','r5'];

function getInterventionsForZone(zoneName) {
  var zone = ZONES.find(function(z) { return z.name === zoneName; });
  if (!zone) return INTERVENTIONS_DB.critical;
  if (zone.bias > 7)   return INTERVENTIONS_DB.critical;
  if (zone.bias > 5.5) return INTERVENTIONS_DB.high;
  if (zone.bias > 3.5) return INTERVENTIONS_DB.moderate;
  return INTERVENTIONS_DB.low;
}

function renderInterventions(filterZone) {
  var list = document.getElementById('interventionList');
  var items;

  if (!filterZone || filterZone === 'all') {
    items = INTERVENTIONS_DB.critical;
  } else {
    items = getInterventionsForZone(filterZone);
  }

  list.innerHTML = items.map(function(item, i) {
    return '<div class="ic">' +
      '<div class="irk ' + (RANK_CLASSES[i] || 'r5') + '">' + (i+1) + '</div>' +
      '<div style="flex:1;min-width:0">' +
        '<div class="in">' + item.name + '</div>' +
        '<div class="id" style="margin-top:3px">' + item.desc + '</div>' +
        '<div style="display:flex;gap:10px;margin-top:6px;flex-wrap:wrap">' +
          '<span style="font-family:var(--fm);font-size:10px;color:var(--c1)">&#8722;' + item.cooling + '°C cooling</span>' +
          '<span style="font-family:var(--fm);font-size:10px;color:var(--ac2)">₹' + item.cost + 'L/km²</span>' +
          '<span style="font-family:var(--fm);font-size:10px;color:var(--ac3)">⏱ ' + item.timeframe + '</span>' +
          '<span style="font-family:var(--fm);font-size:10px;color:var(--ac)">' + item.sdg + '</span>' +
        '</div>' +
      '</div>' +
      '<div style="text-align:right;min-width:60px">' +
        '<div class="ib"><div class="ibf" style="width:' + item.impact + '%"></div></div>' +
        '<div style="font-family:var(--fm);font-size:9px;color:var(--tm);margin-top:3px">' + item.impact + '% impact</div>' +
      '</div>' +
    '</div>';
  }).join('');

  // Also update region summary table
  renderRegionTable(filterZone);
}

function filterInterventions() {
  var zone = document.getElementById('regionFilter').value;
  renderInterventions(zone);
}

function renderRegionTable(filterZone) {
  var tbody = document.getElementById('regionBody');
  var zones = (filterZone && filterZone !== 'all')
    ? ZONES.filter(function(z) { return z.name === filterZone; })
    : ZONES;

  tbody.innerHTML = zones.map(function(z) {
    var interventions = getInterventionsForZone(z.name);
    var top = interventions[0];
    var sc  = sevClass(z.bias);
    var d   = liveData[z.name];
    var airT = d ? d.current.temperature_2m.toFixed(1) + '°C' : '--';
    return '<tr>' +
      '<td><div class="zn">' + z.name + '</div><div style="font-size:9px;color:var(--tm)">' + airT + ' · NDVI ' + z.ndvi + '</div></td>' +
      '<td><span class="sb ' + sc + '">' + sevLabel(z.bias) + '</span></td>' +
      '<td style="font-size:10px">' + top.name + '</td>' +
      '<td style="color:var(--c1);font-family:var(--fm)">−' + top.cooling + '°C</td>' +
      '<td style="font-family:var(--fm)">₹' + top.cost + 'L</td>' +
      '<td style="font-family:var(--fm);color:var(--tm)">' + top.timeframe + '</td>' +
      '<td style="font-family:var(--fm);font-size:9px;color:var(--ac)">' + top.sdg + '</td>' +
    '</tr>';
  }).join('');
}
