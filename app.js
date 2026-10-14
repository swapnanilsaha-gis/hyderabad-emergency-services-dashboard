/* Hyderabad Emergency Services Dashboard - public static edition.
 * A snapshot of the GeoServer Web GIS dashboard: the same ward layer (indicators aggregated from the
 * 1 km hexagon analysis grid), facility layers, SLD class breaks and colours, rendered in the browser
 * with OpenLayers from GeoJSON files, so it works on any static host (GitHub Pages).
 */
(function () {
  'use strict';
  const PAL = ['#00c9a7', '#8ee05c', '#ffe14d', '#ff9f1c', '#ff2e4d'];

  // Theme classes mirror the SLD styles published on GeoServer
  const fmtB = (v, u) => (u === 'm' ? (v >= 1000 ? (v / 1000).toFixed(2).replace(/\.?0+$/, '') + ' km' : v + ' m') : u === 'd' ? v.toLocaleString('en-IN') : v.toFixed(2));
  const LABS = ['Very Low', 'Low', 'Moderate', 'High', 'Very High'];
  function breaksTheme(id, label, field, br, unit) {
    const e = [null, ...br, null];
    const classes = LABS.map((l, i) => ({ col: PAL[i], label: `${l} (${e[i] === null ? 'Under ' + fmtB(e[i + 1], unit) : e[i + 1] === null ? fmtB(e[i], unit) + ' And Above' : fmtB(e[i], unit) + ' To ' + fmtB(e[i + 1], unit)})`,
      test: (v) => (e[i] === null || v >= e[i]) && (e[i + 1] === null || v < e[i + 1]) }));
    return { id, label, field, classes };
  }
  const DESERT_CLASSES = [
    { label: 'No Desert Area (0%)', col: '#3fa7ff', test: (v) => v <= 0 },
    { label: 'Under 10%', col: '#ffe14d', test: (v) => v > 0 && v < 10 },
    { label: '10% To 25%', col: '#ff9f1c', test: (v) => v >= 10 && v < 25 },
    { label: '25% To 50%', col: '#ff6b35', test: (v) => v >= 25 && v < 50 },
    { label: '50% And Above (Desert Ward)', col: '#ff2e4d', test: (v) => v >= 50 }];
  const THEMES = [
    { id: 'desert', label: 'Share Of Area In Service Deserts', field: 'desert_pct', classes: DESERT_CLASSES },
    breaksTheme('hosp', 'Distance To Nearest Hospital', 'd_hosp_m', [250, 350, 500, 900], 'm'),
    breaksTheme('fire', 'Distance To Nearest Fire Station', 'd_fire_m', [1300, 1850, 2500, 3800], 'm'),
    breaksTheme('pol', 'Distance To Nearest Police Station', 'd_pol_m', [500, 800, 1900, 5300], 'm'),
    breaksTheme('phc', 'Distance To Nearest Public Health Centre', 'd_phc_m', [350, 500, 650, 900], 'm'),
    breaksTheme('transit', 'Distance To Nearest Metro Or Rail Station', 'd_trans_m', [650, 1000, 1500, 2500], 'm'),
    breaksTheme('pop', 'Population Density (Persons Per Sq. Km)', 'pop_dens', [9000, 11500, 13000, 14000], 'd'),
    breaksTheme('depriv', 'Deprivation Score', 'depriv_sc', [0.10, 0.11, 0.13, 0.16], 's')
  ];
  const OVERLAYS = [
    { id: 'hospitals', name: 'Hospitals', file: 'hospitals', icon: 'hospital', size: 18, on: false },
    { id: 'phcs', name: 'Public Health Centres', file: 'phcs', icon: 'phc', size: 15, on: false },
    { id: 'fire', name: 'Fire Stations', file: 'fire_stations', icon: 'fire', size: 22, on: true },
    { id: 'police', name: 'Police Stations', file: 'police_stations', icon: 'police', size: 19, on: false },
    { id: 'metro_lines', name: 'Metro Lines', file: 'metro_lines', kind: 'metro', on: true },
    { id: 'metro', name: 'Metro Stations', file: 'metro_stations', icon: 'metro', size: 18, on: false },
    { id: 'rail_lines', name: 'Railway Lines', file: 'rail_lines', kind: 'rail', on: true },
    { id: 'rail', name: 'Railway Stations', file: 'railway_stations', icon: 'rail', size: 18, on: false },
    { id: 'bus', name: 'Bus Stops', file: 'bus_stops', icon: 'bus', size: 13, on: false },
    { id: 'slums', name: 'Slum Settlements', file: 'slums', kind: 'slum', on: false },
    { id: 'flood', name: 'Flood / Water-Logging Points', file: 'flood_points', icon: 'flood', size: 20, on: false }
  ];

  const $ = (id) => document.getElementById(id);
  const fmtInt = (n) => Math.round(n || 0).toLocaleString('en-IN');
  const fmtKm = (m) => (m >= 1000 ? (m / 1000).toFixed(2) + ' km' : Math.round(m || 0) + ' m');
  const fmtPop = (n) => (n >= 1e5 ? (n / 1e5).toFixed(2) + ' Lakh' : fmtInt(n));
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const titleCase = (s) => String(s ?? '').toLowerCase().replace(/(^|[\s\-/(.])([a-z])/g, (m, p, c) => p + c.toUpperCase());
  // ---------- base maps (Esri tiles need no API key) ----------
  const esri = (svc, attr, maxZoom = 19) => new ol.layer.Tile({
    visible: false,
    source: new ol.source.XYZ({ url: `https://server.arcgisonline.com/ArcGIS/rest/services/${svc}/MapServer/tile/{z}/{y}/{x}`, crossOrigin: 'anonymous', attributions: attr, maxZoom })
  });
  const darkRef = new ol.layer.Tile({ visible: false, zIndex: 50,
    source: new ol.source.XYZ({ url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}', crossOrigin: 'anonymous', maxZoom: 16 }) });
  const bases = {
    dark: esri('Canvas/World_Dark_Gray_Base', 'Base Map &copy; Esri, HERE, Garmin', 16),
    streets: esri('World_Street_Map', 'Base Map &copy; Esri, HERE, Garmin, OpenStreetMap Contributors'),
    gray: esri('Canvas/World_Light_Gray_Base', 'Base Map &copy; Esri, HERE, Garmin', 16),
    imagery: esri('World_Imagery', 'Imagery &copy; Esri, Maxar, Earthstar Geographics'),
    osm: new ol.layer.Tile({ visible: false, source: new ol.source.OSM({ crossOrigin: 'anonymous' }) })
  };
  bases.dark.setVisible(true); darkRef.setVisible(true);

  let theme = THEMES[0];
  const geojson = new ol.format.GeoJSON({ featureProjection: 'EPSG:3857' });
  const S = ol.style;
  const styleCache = {};
  const wardSource = new ol.source.Vector();
  let passes = () => true;
  const themeLayer = new ol.layer.Vector({ source: wardSource, opacity: 0.85, declutter: false,
    style: (f, res) => {
      if (!passes(f.getProperties())) return null;
      const v = +f.get(theme.field); const cls = theme.classes.find((c) => c.test(v)) || theme.classes[0];
      const key = theme.id + cls.col;
      if (!styleCache[key]) styleCache[key] = new S.Style({ fill: new S.Fill({ color: cls.col }), stroke: new S.Stroke({ color: 'rgba(16,22,28,0.9)', width: 0.7 }) });
      if (res > 12) return styleCache[key];
      return [styleCache[key], new S.Style({ text: new S.Text({ text: titleCase(f.get('ward')), font: 'bold 11px "Times New Roman", serif', fill: new S.Fill({ color: '#13212e' }), stroke: new S.Stroke({ color: '#fff', width: 3 }), overflow: false }) })];
    } });
  const icon = (name, size) => new S.Style({ image: new S.Icon({ src: `icons/${name}.svg`, width: size, height: size }) });
  const lineStyles = {
    metro: (f) => new S.Style({ stroke: new S.Stroke({ color: { Red: '#e3242b', Blue: '#1f5fd1', Green: '#16a34a' }[f.get('line')] || '#888', width: 3.5, lineCap: 'round' }) }),
    rail: () => [new S.Style({ stroke: new S.Stroke({ color: '#555555', width: 2.2 }) }), new S.Style({ stroke: new S.Stroke({ color: '#ffffff', width: 1.2, lineDash: [6, 6] }) })],
    slum: (f) => new S.Style({ fill: new S.Fill({ color: f.get('status') === 'Notified' ? 'rgba(123,50,148,0.55)' : f.get('status') === 'Non-Notified' ? 'rgba(194,165,207,0.65)' : 'rgba(229,216,234,0.6)' }), stroke: new S.Stroke({ color: '#4a1a5c', width: 0.6 }) })
  };
  const overlayLayers = {};
  OVERLAYS.forEach((o) => {
    const src = new ol.source.Vector({ url: `data/${o.file}.geojson`, format: geojson });
    const st = o.icon ? icon(o.icon, o.size) : lineStyles[o.kind];
    overlayLayers[o.id] = new ol.layer.Vector({ source: src, visible: o.on, style: st, declutter: false });
    overlayLayers[o.id].set('ltype', o.file);
  });
  themeLayer.set('ltype', 'wards');
  const hiSource = new ol.source.Vector();
  const hiLayer = new ol.layer.Vector({ source: hiSource,
    style: [new ol.style.Style({ stroke: new ol.style.Stroke({ color: '#ffffff', width: 7 }) }),
      new ol.style.Style({ stroke: new ol.style.Stroke({ color: '#f2a541', width: 3.5 }) })] });

  const popupEl = $('popup');
  const popup = new ol.Overlay({ element: popupEl, positioning: 'bottom-center', offset: [0, -12], autoPan: { animation: { duration: 250 }, margin: 30 } });
  const HOME = ol.proj.transformExtent([78.24, 17.29, 78.62, 17.56], 'EPSG:4326', 'EPSG:3857');
  const map = new ol.Map({
    target: 'map',
    layers: [...Object.values(bases), themeLayer, ...OVERLAYS.map((o) => overlayLayers[o.id]), darkRef, hiLayer],
    overlays: [popup],
    controls: ol.control.defaults.defaults({ attributionOptions: { collapsible: true } }).extend([new ol.control.ScaleLine()]),
    view: new ol.View({ center: ol.extent.getCenter(HOME), zoom: 11, maxZoom: 19 })
  });
  map.getView().fit(HOME, { padding: [60, 20, 20, 20] });

  let tileErr = 0;
  Object.values(bases).forEach((b) => b.getSource().on('tileloaderror', () => {
    if (++tileErr === 8) showMsg('Base Map Tiles Could Not Load. Check The Internet Connection Or Choose Another Base Map.');
  }));
  function showMsg(t, err) { const m = $('mapMsg'); m.textContent = t; m.hidden = false; m.classList.toggle('err', !!err); }
  function hideMsg() { $('mapMsg').hidden = true; }

  // ---------- theme, base map, layers ----------
  const sel = $('themeSel');
  THEMES.forEach((t) => sel.add(new Option(t.label, t.id)));
  sel.addEventListener('change', () => setTheme(sel.value));
  $('opacity').addEventListener('input', (e) => themeLayer.setOpacity(e.target.value / 100));
  $('baseSel').addEventListener('change', (e) => { Object.entries(bases).forEach(([k, l]) => l.setVisible(k === e.target.value)); darkRef.setVisible(e.target.value === 'dark'); tileErr = 0; hideMsg(); });
  const legendHtml = (classes) => '<div class="lg">' + classes.map((c) => `<div class="lg-r"><i style="background:${c.col}"></i>${c.label}</div>`).join('') + '</div>';
  function setTheme(id) {
    theme = THEMES.find((t) => t.id === id);
    themeLayer.changed();
    $('themeLegend').innerHTML = `<h4>${theme.label}</h4>` + legendHtml(theme.classes);
    closePopup();
  }
  const OV_LEGEND = {
    metro_lines: '<span class="lg-line" style="background:linear-gradient(#e3242b 0 33%,#1f5fd1 33% 66%,#16a34a 66%)"></span>',
    rail_lines: '<span class="lg-line rail"></span>', slums: '<span class="lg-box" style="background:rgba(123,50,148,.6);border-color:#4a1a5c"></span>' };
  const ovIcon = (o) => (o.icon ? `<img alt="" src="icons/${o.icon}.svg">` : OV_LEGEND[o.id]);
  const list = $('layerList');
  OVERLAYS.forEach((o) => {
    const row = document.createElement('label');
    row.className = 'lyr';
    row.innerHTML = `<input type="checkbox" ${o.on ? 'checked' : ''}>${ovIcon(o)}<span>${o.name}</span>`;
    row.querySelector('input').addEventListener('change', (e) => { overlayLayers[o.id].setVisible(e.target.checked); closePopup(); });
    list.appendChild(row);
  });
  $('lbToggle').addEventListener('click', () => $('layerBox').classList.toggle('open'));
  function buildLegendPane() {
    $('legendAll').innerHTML = THEMES.map((t) => `<div class="legend-item"><h5>${t.label}${t.id === theme.id ? ' (Current Theme)' : ''}</h5>${legendHtml(t.classes)}</div>`).join('') +
      '<div class="legend-item"><h5>Map Layers</h5><div class="lg">' + OVERLAYS.map((o) => `<div class="lg-r lg-ov">${ovIcon(o)}${o.name}</div>`).join('') +
      '<div class="lg-r"><i style="background:rgba(123,50,148,.6)"></i>Notified Slum</div><div class="lg-r"><i style="background:rgba(194,165,207,.75)"></i>Non-Notified Slum</div></div></div>';
  }
  document.querySelectorAll('nav.seg[data-for="main"] .seg-b').forEach((b) => b.addEventListener('click', () => {
    document.querySelectorAll('nav.seg[data-for="main"] .seg-b').forEach((x) => x.classList.toggle('active', x === b));
    document.querySelectorAll('.pane').forEach((p) => p.classList.toggle('active', p.id === b.dataset.pane));
    if (b.dataset.pane === 'pane-legend') buildLegendPane();
    if (b.dataset.pane === 'pane-map') map.updateSize();
  }));

  // ---------- popups ----------
  const LABELS = { wards: 'Ward', hospitals: 'Hospital', phcs: 'Public Health Centre', fire_stations: 'Fire Station',
    police_stations: 'Police Station', metro_stations: 'Metro Station', railway_stations: 'Railway Station', bus_stops: 'Bus Stop',
    slums: 'Slum Settlement', flood_points: 'Flood / Water-Logging Point', metro_lines: 'Metro Line', rail_lines: 'Railway Line' };
  const FIELD = { name: 'Name', ward: 'Ward', circle: 'Circle', zone: 'Zone', mandal: 'Mandal', type: 'Type', operator: 'Operator', railway: 'Type', district: 'District', address: 'Address' };
  map.on('singleclick', (evt) => {
    const hits = [];
    map.forEachFeatureAtPixel(evt.pixel, (f, l) => {
      const t = l && l.get('ltype'); if (!t || hiLayer === l) return;
      if (t === 'wards' && !passes(f.getProperties())) return;
      if (!hits.some((h) => h.t === t)) hits.push({ t, p: f.getProperties() });
    }, { hitTolerance: 5 });
    hits.sort((a, b) => (a.t === 'wards') - (b.t === 'wards'));
    if (!hits.length) { closePopup(); return; }
    $('popupContent').innerHTML = hits.slice(0, 2).map((h) => renderOne(h.t, h.p)).join('<div class="pp-sep"></div>');
    const below = evt.pixel[1] < map.getSize()[1] * 0.55;
    popup.setPositioning(below ? 'top-center' : 'bottom-center'); popup.setOffset(below ? [0, 12] : [0, -12]);
    popupEl.classList.add('show'); popup.setPosition(evt.coordinate);
  });
  map.on('pointermove', (evt) => { if (!evt.dragging) map.getTargetElement().style.cursor = map.hasFeatureAtPixel(evt.pixel, { hitTolerance: 5 }) ? 'pointer' : ''; });
  function closePopup() { popupEl.classList.remove('show'); popup.setPosition(undefined); }
  $('popupClose').addEventListener('click', closePopup);
  const row = (k, v) => (v === null || v === undefined || v === '' ? '' : `<tr><td>${k}</td><td>${v}</td></tr>`);
  const deCol = (v) => (v <= 0 ? '#3fa7ff' : v < 10 ? '#d4b400' : v < 25 ? '#ff9f1c' : v < 50 ? '#ff6b35' : '#ff2e4d');
  const tag = (t, c) => `<span class="pp-tag" style="background:${c}">${esc(t)}</span>`;
  function renderOne(type, p) {
    if (type === 'wards') {
      const dc = p.desert_sts === 'Desert Ward' ? '#ff2e4d' : p.desert_sts === 'Partly Desert' ? '#e07a1f' : '#64707d';
      return `<div class="pp-h">${esc(titleCase(p.ward))}</div>` + tag(`${p.desert_pct}% Area In Deserts`, deCol(+p.desert_pct)) + tag(p.desert_sts, dc) +
        '<table class="pp-tbl">' + row('Zone', esc(titleCase(p.zone))) + row('Circle', esc(titleCase(p.circle))) +
        row('Population (2025)', fmtInt(p.pop_2025)) + row('Density Per Sq. Km', fmtInt(p.pop_dens)) +
        row('Area In Service Deserts', `${p.desert_pct}%`) + row('Population In Deserts', fmtInt(p.desert_pop)) +
        row('Hospital (Straight / Road)', `${fmtKm(p.d_hosp_m)} / ${fmtKm(p.nd_hosp_m)}`) +
        row('Fire Station (Straight / Road)', `${fmtKm(p.d_fire_m)} / ${fmtKm(p.nd_fire_m)}`) +
        row('Police Station (Straight / Road)', `${fmtKm(p.d_pol_m)} / ${fmtKm(p.nd_pol_m)}`) +
        row('PHC (Straight / Road)', `${fmtKm(p.d_phc_m)} / ${fmtKm(p.nd_phc_m)}`) +
        row('Metro Or Rail Station', fmtKm(p.d_trans_m)) +
        row('Facilities In Ward', `${p.n_hosp} Hosp. / ${p.n_phc} PHC / ${p.n_fire} Fire / ${p.n_pol} Police`) +
        row('Slums (Population)', `${p.n_slums} (${fmtInt(p.slum_pop)})`) + row('Flood Points', p.n_flood) +
        row('Deprivation Score', `${(+p.depriv_sc).toFixed(3)} (Rank ${p.depriv_rk} Of 155)`) + '</table>';
    }
    const label = LABELS[type] || titleCase(type);
    const title = titleCase(p.name || (type === 'bus_stops' ? `Bus Stop ${p.stop_no}` : type === 'metro_lines' ? `${p.line} Line` : label));
    const skip = new Set(['name', 'stop_no']);
    const extra = { population: ['Population', fmtInt(p.population)], status: ['Status', esc(titleCase(p.status))], daily_trips: ['Daily Trips', fmtInt(p.daily_trips)],
      code: ['Station Code', esc(p.code)], route: ['Route', esc(titleCase(p.route))], wardno: ['Ward No.', esc(p.wardno)] };
    const rows = Object.entries(p).filter(([k, v]) => k !== 'geometry' && !k.startsWith('fid') && !skip.has(k) && v !== null && v !== '' && k !== 'line')
      .map(([k, v]) => (extra[k] ? row(...extra[k]) : row(FIELD[k] || titleCase(k.replace(/_/g, ' ')), esc(titleCase(v))))).join('');
    return `<div class="pp-h">${esc(title)}</div>` + tag(label, '#13212e') + `<table class="pp-tbl">${rows}</table>`;
  }

  // ---------- filters -> CQL ----------
  const state = { cls: new Set([1, 2, 3, 4, 5]), desert: '', zone: '', hosp: 0, fire: 0, pol: 0, phc: 0, pop: 0, follow: true };
  function buildCql() {
    const p = [];
    if (state.cls.size < 5) {
      const R = { 1: 'desert_pct <= 0', 2: '(desert_pct > 0 AND desert_pct < 10)', 3: '(desert_pct >= 10 AND desert_pct < 25)',
        4: '(desert_pct >= 25 AND desert_pct < 50)', 5: 'desert_pct >= 50' };
      const sel = [...state.cls].sort();
      p.push(sel.length ? (sel.length === 1 ? R[sel[0]] : '(' + sel.map((k) => R[k]).join(' OR ') + ')') : 'desert_pct < -1');
    }
    if (state.zone) p.push(`zone = '${state.zone.replace(/'/g, "''")}'`);
    if (state.hosp > 0) p.push(`d_hosp_m >= ${state.hosp}`);
    if (state.fire > 0) p.push(`d_fire_m >= ${state.fire}`);
    if (state.pol > 0) p.push(`d_pol_m >= ${state.pol}`);
    if (state.phc > 0) p.push(`d_phc_m >= ${state.phc}`);
    if (state.pop > 0) p.push(`pop_dens >= ${state.pop}`);
    return p.length ? p.join(' AND ') : 'INCLUDE';
  }
  function buildPredicate() {
    const R = { 1: (v) => v <= 0, 2: (v) => v > 0 && v < 10, 3: (v) => v >= 10 && v < 25, 4: (v) => v >= 25 && v < 50, 5: (v) => v >= 50 };
    const s = { ...state, cls: new Set(state.cls) };
    return (p) => [...s.cls].some((k) => R[k](+p.desert_pct)) && (!s.zone || p.zone === s.zone) &&
      +p.d_hosp_m >= s.hosp && +p.d_fire_m >= s.fire && +p.d_pol_m >= s.pol && +p.d_phc_m >= s.phc && +p.pop_dens >= s.pop;
  }
  let deb, cql = 'INCLUDE', lastZone = '';
  function onFilterChange() {
    cql = buildCql();
    $('cqlText').textContent = cql;
    $('vHosp').textContent = fmtKm(state.hosp); $('vFire').textContent = fmtKm(state.fire); $('vPol').textContent = fmtKm(state.pol); $('vPhc').textContent = fmtKm(state.phc); $('vPop').textContent = fmtInt(state.pop);
    clearTimeout(deb);
    deb = setTimeout(() => {
      passes = buildPredicate(); themeLayer.changed();
      if (state.zone !== lastZone) {
        lastZone = state.zone;
        const fs = filtered();
        if (state.zone && fs.length) { const ext = ol.extent.createEmpty(); fs.forEach((f) => ol.extent.extend(ext, f.getGeometry().getExtent())); map.getView().fit(ext, { duration: 500, padding: [70, 40, 40, 40], maxZoom: 14 }); }
        else if (!state.zone) map.getView().fit(HOME, { duration: 500, padding: [60, 20, 20, 20] });
      }
      refreshStats(); loadTop10();
    }, 150);
  }
  document.querySelectorAll('#clsChips .chip').forEach((c) => c.addEventListener('click', () => {
    const v = +c.dataset.v; c.classList.toggle('on');
    c.classList.contains('on') ? state.cls.add(v) : state.cls.delete(v); onFilterChange();
  }));
  $('fZone').addEventListener('change', (e) => { state.zone = e.target.value; onFilterChange(); });
  $('fHosp').addEventListener('input', (e) => { state.hosp = +e.target.value; onFilterChange(); });
  $('fFire').addEventListener('input', (e) => { state.fire = +e.target.value; onFilterChange(); });
  $('fPol').addEventListener('input', (e) => { state.pol = +e.target.value; onFilterChange(); });
  $('fPhc').addEventListener('input', (e) => { state.phc = +e.target.value; onFilterChange(); });
  $('fPop').addEventListener('input', (e) => { state.pop = +e.target.value; onFilterChange(); });
  $('fView').addEventListener('change', (e) => { state.follow = e.target.checked; refreshStats(); });
  $('fReset').addEventListener('click', () => {
    Object.assign(state, { cls: new Set([1, 2, 3, 4, 5]), desert: '', zone: '', hosp: 0, fire: 0, pol: 0, phc: 0, pop: 0 });
    document.querySelectorAll('#clsChips .chip').forEach((c) => c.classList.add('on'));
    ['fZone'].forEach((id) => { $(id).value = ''; });
    ['fHosp', 'fFire', 'fPol', 'fPhc', 'fPop'].forEach((id) => { $(id).value = 0; });
    hiSource.clear(); onFilterChange();
  });

  // ---------- ward data ----------
  let wards = [];
  const filtered = () => wards.filter((f) => passes(f.getProperties()));
  function inView() {
    const fs = filtered();
    if (!state.follow) return fs;
    const ext = map.getView().calculateExtent(map.getSize());
    return fs.filter((f) => ol.extent.intersects(ext, f.getGeometry().getExtent()));
  }
  function refreshStats() {
    const fs = inView().map((f) => f.getProperties());
    const where = state.follow ? 'In Map View' : 'Across GHMC';
    const pop = fs.reduce((s, p) => s + (+p.pop_2025 || 0), 0);
    const wavg = (k) => (pop ? fs.reduce((s, p) => s + (+p[k] || 0) * (+p.pop_2025 || 0), 0) / pop : 0);
    const dW = fs.filter((p) => p.desert_sts === 'Desert Ward').length, pW = fs.filter((p) => p.desert_sts === 'Partly Desert').length;
    const dPop = fs.reduce((s, p) => s + (+p.desert_pop || 0), 0);
    $('kW').textContent = fmtInt(fs.length); $('kWS').textContent = `Of 155 Wards${cql !== 'INCLUDE' ? ' (Filtered)' : ''}`;
    $('kD').textContent = fmtInt(dW); $('kDS').textContent = `Plus ${pW} Partly Affected Wards`;
    $('kP').textContent = fmtPop(dPop); $('kPS').textContent = pop ? `${(100 * dPop / pop).toFixed(1)}% Of ${fmtPop(pop)} ${where}` : where;
    $('kH').textContent = fs.length ? fmtKm(wavg('d_hosp_m')) : '–'; $('kHS').textContent = `By Road: ${fs.length ? fmtKm(wavg('nd_hosp_m')) : '–'}`;
    $('kPo').textContent = fs.length ? fmtKm(wavg('d_pol_m')) : '\u2013'; $('kPoS').textContent = `By Road: ${fs.length ? fmtKm(wavg('nd_pol_m')) : '\u2013'}`;
    $('kPh').textContent = fs.length ? fmtKm(wavg('d_phc_m')) : '\u2013'; $('kPhS').textContent = `By Road: ${fs.length ? fmtKm(wavg('nd_phc_m')) : '\u2013'}`;
    $('kF').textContent = fs.length ? fmtKm(wavg('d_fire_m')) : '–'; $('kFS').textContent = `By Road: ${fs.length ? fmtKm(wavg('nd_fire_m')) : '–'}`;
    drawChart(fs);
  }
  map.on('moveend', () => { if (wards.length) refreshStats(); });

  // ---------- priority wards ----------
  function loadTop10() {
    const el = $('top10');
    const feats = filtered().slice().sort((a, b) => (b.get('desert_pct') - a.get('desert_pct')) || (b.get('depriv_sc') - a.get('depriv_sc'))).slice(0, 10);
    if (!feats.length) { el.innerHTML = '<li class="muted">No Wards Match The Current Filter</li>'; return; }
    el.innerHTML = '';
    feats.forEach((f, i) => {
      const p = f.getProperties();
      const li = document.createElement('li');
      li.innerHTML = `<div class="rk">${i + 1}</div><div><div class="nm">${esc(titleCase(p.ward))}</div>
        <div class="sub">${esc(titleCase(p.zone))} &middot; ${fmtInt(p.pop_2025)} People &middot; Hospital ${fmtKm(p.d_hosp_m)}</div>
        <div class="bar"><i style="width:${Math.max(2, p.desert_pct)}%"></i></div></div>
        <div class="pct">${(+p.desert_pct).toFixed(0)}%<small>Desert Area</small></div>`;
      li.addEventListener('click', () => {
        hiSource.clear(); hiSource.addFeature(f.clone());
        map.getView().fit(f.getGeometry().getExtent(), { duration: 500, padding: [80, 60, 60, 60], maxZoom: 15 });
      });
      el.appendChild(li);
    });
  }

  // ---------- charts ----------
  let chart, chartKind = 'desert';
  Chart.defaults.font.family = '"Times New Roman", Times, serif';
  Chart.defaults.color = '#46525e';
  document.querySelectorAll('#chartTabs .seg-b').forEach((b) => b.addEventListener('click', () => {
    document.querySelectorAll('#chartTabs .seg-b').forEach((x) => x.classList.toggle('active', x === b));
    chartKind = b.dataset.chart; drawChart(inView().map((f) => f.getProperties()));
  }));
  function opts(title, extra = {}) {
    return Object.assign({ responsive: true, maintainAspectRatio: false, animation: { duration: 300 },
      plugins: { legend: { position: 'bottom', labels: { boxWidth: 12 } }, title: { display: true, text: title, color: '#13212e', font: { size: 14, weight: 'bold' } } } }, extra);
  }
  // Same five classes as the Service Desert map (SLD ghmc_w_desert)
  const CATS = [
    { name: 'No Desert Area (0%)', short: 'No Desert (0%)', col: '#3fa7ff', test: (v) => v <= 0 },
    { name: 'Under 10%', short: 'Under 10%', col: '#ffe14d', test: (v) => v > 0 && v < 10 },
    { name: '10% To 25%', short: '10% To 25%', col: '#ff9f1c', test: (v) => v >= 10 && v < 25 },
    { name: '25% To 50%', short: '25% To 50%', col: '#ff6b35', test: (v) => v >= 25 && v < 50 },
    { name: '50% And Above (Desert Ward)', short: '50%+ (Desert Ward)', col: '#ff2e4d', test: (v) => v >= 50 }];
  const inCat = (fs, c) => fs.filter((p) => c.test(+p.desert_pct));
  const popW = (g, k) => { const pop = g.reduce((s, p) => s + (+p.pop_2025 || 0), 0); return pop ? g.reduce((s, p) => s + (+p[k] || 0) * (+p.pop_2025 || 0), 0) / pop : 0; };
  function drawChart(fs) {
    if (chart) chart.destroy();
    const ctx = $('chart'), note = $('chartNote');
    const titleOf = (t) => ({ display: true, text: t, color: '#13212e', font: { size: 14, weight: 'bold' } });
    const legendBottom = { position: 'bottom', labels: { boxWidth: 11, font: { size: 11 } } };
    const empty = CATS.filter((c) => !inCat(fs, c).length).map((c) => c.short);
    const emptyNote = empty.length ? ` No Wards In: ${empty.join(', ')}.` : '';
    if (chartKind === 'desert') {
      chart = new Chart(ctx, { type: 'pie',
        data: { labels: CATS.map((c) => c.name), datasets: [{ data: CATS.map((c) => inCat(fs, c).length), backgroundColor: CATS.map((c) => c.col), borderColor: '#fff', borderWidth: 2 }] },
        options: opts('', { plugins: { legend: { position: 'right', labels: { boxWidth: 12, font: { size: 12 } } }, title: titleOf('Wards By Share Of Area In Service Deserts'),
          tooltip: { callbacks: { label: (c) => ` ${c.label}: ${c.raw} Wards` } } } }) });
      note.textContent = 'Same Classes As The Service Desert Map. Desert Ward = Half Or More Of Its Area In Service Deserts.';
    } else if (chartKind === 'dist') {
      const keys = [['d_hosp_m', 'Hospital'], ['d_phc_m', 'PHC'], ['d_fire_m', 'Fire Station'], ['d_pol_m', 'Police Station']];
      const ds = CATS.map((c) => { const g = inCat(fs, c); return { label: c.short, backgroundColor: c.col, borderRadius: 3, data: keys.map(([k]) => popW(g, k) / 1000) }; });
      chart = new Chart(ctx, { type: 'bar', data: { labels: keys.map((k) => k[1]), datasets: ds },
        options: opts('', { plugins: { legend: legendBottom, title: titleOf('Average Distance To Nearest Facility By Desert Class'),
          tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${c.raw.toFixed(2)} km` } } },
          scales: { y: { title: { display: true, text: 'Distance (km)' }, grid: { color: '#eef1f4' } }, x: { grid: { display: false } } } }) });
      note.textContent = 'Population-Weighted Straight-Line Distance.' + emptyNote;
    } else if (chartKind === 'zones') {
      const zones = [...new Set(fs.map((p) => p.zone || 'Unassigned Zone'))].sort();
      const ds = CATS.map((c) => ({ label: c.short, backgroundColor: c.col, borderRadius: 2,
        data: zones.map((z) => inCat(fs, c).filter((p) => (p.zone || 'Unassigned Zone') === z).length) }));
      chart = new Chart(ctx, { type: 'bar',
        data: { labels: zones.map((z) => titleCase(z).replace(' Zone', '').replace('Unassigned', 'Other')), datasets: ds },
        options: opts('', { plugins: { legend: legendBottom, title: titleOf('Wards In Each GHMC Zone By Desert Class') },
          scales: { x: { stacked: true, grid: { display: false }, ticks: { autoSkip: false, maxRotation: 35, minRotation: 35, font: { size: 11 } } },
            y: { stacked: true, title: { display: true, text: 'Number Of Wards' }, grid: { color: '#eef1f4' }, ticks: { precision: 0 } } } }) });
      note.textContent = 'Each Bar Is Split Into The Same Five Classes As The Service Desert Map.';
    } else {
      const vals = CATS.map((c) => { const g = inCat(fs, c); return g.length ? g.reduce((s, p) => s + (+p.depriv_sc || 0), 0) / g.length : 0; });
      chart = new Chart(ctx, { type: 'bar',
        data: { labels: CATS.map((c) => c.short), datasets: [{ label: 'Average Deprivation Score', data: vals, backgroundColor: CATS.map((c) => c.col), borderRadius: 4 }] },
        options: opts('', { plugins: { legend: { display: false }, title: titleOf('Average Deprivation Score By Desert Class'),
          tooltip: { callbacks: { label: (c) => ` Score ${c.raw.toFixed(3)} (${inCat(fs, CATS[c.dataIndex]).length} Wards)` } } },
          scales: { y: { title: { display: true, text: 'Average Deprivation Score' }, grid: { color: '#eef1f4' } },
            x: { grid: { display: false }, ticks: { autoSkip: false, maxRotation: 30, minRotation: 30, font: { size: 11 } } } } }) });
      note.textContent = 'Higher Score Means Worse Combined Access, Demand And Vulnerability.' + emptyNote;
    }
  }

  // ---------- start ----------
  fetch('data/wards.geojson').then((r) => r.json()).then((j) => {
    wards = geojson.readFeatures(j);
    wardSource.addFeatures(wards);
    [...new Set(wards.map((f) => f.get('zone')).filter(Boolean))].sort().forEach((z) => $('fZone').add(new Option(titleCase(z), z)));
    setTheme(theme.id);
    onFilterChange();
  }).catch((e) => showMsg('Could Not Load The Ward Data: ' + e.message, true));
  setTheme(theme.id);
})();
