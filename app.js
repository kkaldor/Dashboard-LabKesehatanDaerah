/*
  Dashboard Logic (Statis)
  - Hitung KPI dari data mock
  - Filter data
  - Render tabel & grafik (tanpa library eksternal)
  - Ekspor CSV sederhana
*/

(function () {
  const els = {
    fromDate: document.getElementById('fromDate'),
    toDate: document.getElementById('toDate'),
    shift: document.getElementById('shift'),
    jenis: document.getElementById('jenis'),

    search: document.getElementById('search'),
    tableBody: document.getElementById('tableBody'),

    kpiSamples: document.getElementById('kpiSamples'),
    kpiDone: document.getElementById('kpiDone'),
    kpiSla: document.getElementById('kpiSla'),
    kpiAvgTime: document.getElementById('kpiAvgTime'),

    queueDone: document.getElementById('queueDone'),
    queueBacklog: document.getElementById('queueBacklog'),

    chartMode: document.getElementById('chartMode'),
    chartTitle: document.getElementById('chartTitle'),
    chartBars: document.getElementById('chartBars'),

    exportBtn: document.getElementById('exportBtn'),
    exportNote: document.getElementById('exportNote'),

    emptyState: document.getElementById('emptyState'),
  };

  const state = {
    sortKey: 'tanggalMasuk',
    sortDir: 'desc',
  };

  function parseISODate(s) {
    // s: YYYY-MM-DD
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  function inDateRange(row, from, to) {
    if (!from && !to) return true;
    const t = parseISODate(row.tanggalMasuk);
    if (from && t < from) return false;
    if (to && t > to) return false;
    return true;
  }

  function getFilters() {
    const from = els.fromDate.value ? parseISODate(els.fromDate.value) : null;
    const to = els.toDate.value ? parseISODate(els.toDate.value) : null;
    if (to) to.setHours(23, 59, 59, 999);

    const shift = els.shift.value;
    const jenis = els.jenis.value;

    return { from, to, shift, jenis };
  }

  function normalizeText(s) {
    return String(s ?? '').toLowerCase().trim();
  }

  function matchesSearch(row, q) {
    if (!q) return true;
    const qq = normalizeText(q);
    return (
      normalizeText(row.id).includes(qq) ||
      normalizeText(row.jenisPemeriksaan).includes(qq) ||
      normalizeText(row.lokasiSampel).includes(qq) ||
      normalizeText(row.shift).includes(qq)
    );
  }

  function applyFilters(data) {
    const { from, to, shift, jenis } = getFilters();
    const q = els.search.value;

    return data.filter((row) => {
      if (!inDateRange(row, from, to)) return false;
      if (shift !== 'Semua' && row.shift !== shift) return false;
      if (jenis !== 'Semua') {
        if (row.jenisPemeriksaanId !== jenis && row.jenisPemeriksaan !== jenis) return false;
      }
      if (!matchesSearch(row, q)) return false;
      return true;
    });
  }

  function computeKPI(rows) {
    const totalMasuk = rows.length;
    const selesai = rows.filter((r) => r.status === 'Selesai').length;

    const tepatWaktu = rows.filter((r) => r.slaKepatuhan === 'Tepat Waktu').length;
    const slaPct = totalMasuk ? (tepatWaktu / totalMasuk) * 100 : 0;

    const avgWaktu = totalMasuk
      ? rows.reduce((acc, r) => acc + (Number(r.waktuProsesJam) || 0), 0) / totalMasuk
      : 0;

    return {
      totalMasuk,
      selesai,
      slaPct,
      avgWaktu,
    };
  }

  function groupBy(arr, keyFn) {
    const m = new Map();
    for (const item of arr) {
      const k = keyFn(item);
      m.set(k, (m.get(k) || 0) + 1);
    }
    return m;
  }

  function formatLabel(mode, d) {
    // d: Date
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    if (mode === 'Harian') return `${dd}/${mm}`;

    // Mingguan: tampilkan tanggal awal pekan (Senin) s.d. Senin+6
    const day = d.getDay(); // 0=Sun..6=Sat
    const diffToMonday = (day + 6) % 7; // Monday->0
    const monday = new Date(d);
    monday.setDate(d.getDate() - diffToMonday);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const d1 = String(monday.getDate()).padStart(2, '0');
    const m1 = String(monday.getMonth() + 1).padStart(2, '0');
    const d2 = String(sunday.getDate()).padStart(2, '0');
    const m2 = String(sunday.getMonth() + 1).padStart(2, '0');

    return `Pek. ${d1}/${m1} - ${d2}/${m2}`;
  }

  function renderChart(rows) {
    const mode = els.chartMode.value;
    els.chartTitle.textContent = mode === 'Harian' ? 'Tren Harian (Jumlah Sampel)' : 'Tren Mingguan (Jumlah Sampel)';

    // group by
    const counts = groupBy(rows, (r) => {
      const d = parseISODate(r.tanggalMasuk);
      if (mode === 'Harian') return r.tanggalMasuk;
      // weekly key: Monday date
      const day = d.getDay();
      const diffToMonday = (day + 6) % 7;
      const monday = new Date(d);
      monday.setDate(d.getDate() - diffToMonday);
      return monday.toISOString().slice(0, 10);
    });

    const keys = Array.from(counts.keys()).sort();

    if (keys.length === 0) {
      els.chartBars.innerHTML = '';
      return;
    }

    const values = keys.map((k) => counts.get(k));
    const max = Math.max(...values, 1);

    const frag = document.createDocumentFragment();
    keys.forEach((k) => {
      const count = counts.get(k);
      const ratio = count / max;
      const bar = document.createElement('div');
      bar.className = 'bar';

      const d = parseISODate(k);
      bar.innerHTML = `
        <div class="barFill" style="height:${Math.round(ratio * 100)}%"></div>
        <div class="barLabel">${formatLabel(mode, d)}</div>
        <div class="barValue">${count}</div>
      `;
      frag.appendChild(bar);
    });

    els.chartBars.innerHTML = '';
    els.chartBars.appendChild(frag);
  }

  function renderTable(rows) {
    els.tableBody.innerHTML = '';

    const q = els.search.value;

    if (!rows.length) {
      els.emptyState.style.display = 'block';
      return;
    }

    els.emptyState.style.display = 'none';

    const sorted = [...rows].sort((a, b) => {
      const dir = state.sortDir === 'asc' ? 1 : -1;
      const av = a[state.sortKey];
      const bv = b[state.sortKey];

      // date keys
      if (state.sortKey === 'tanggalMasuk' || state.sortKey === 'tanggalSelesai') {
        return (parseISODate(String(av)).getTime() - parseISODate(String(bv)).getTime()) * dir;
      }

      if (typeof av === 'number' || typeof bv === 'number') {
        return (Number(av || 0) - Number(bv || 0)) * dir;
      }

      return String(av ?? '').localeCompare(String(bv ?? ''), 'id') * dir;
    });

    const frag = document.createDocumentFragment();

    for (const r of sorted.slice(0, 500)) {
      const tr = document.createElement('tr');
      const waktu = `${r.waktuProsesJam} jam`;
      const slaBadge = r.slaKepatuhan === 'Tepat Waktu' ? 'badge ok' : 'badge warn';
      tr.innerHTML = `
        <td>${r.id}</td>
        <td>${r.tanggalMasuk}</td>
        <td>${r.shift}</td>
        <td>${r.jenisPemeriksaan}</td>
        <td>${r.lokasiSampel}</td>
        <td>${r.status}</td>
        <td>${waktu}</td>
        <td><span class="${slaBadge}">${r.slaKepatuhan}</span></td>
        <td>${r.tanggalSelesai}</td>
      `;
      frag.appendChild(tr);
    }

    els.tableBody.appendChild(frag);
  }

  function updateAll() {
    // Data
    const data = window.MOCK_LAB?.pemeriksaan || [];

    // Filter
    const filtered = applyFilters(data);

    // KPI
    const kpi = computeKPI(filtered);
    els.kpiSamples.textContent = String(kpi.totalMasuk);
    els.kpiDone.textContent = String(kpi.selesai);
    els.kpiSla.textContent = `${kpi.slaPct.toFixed(1)}%`;
    els.kpiAvgTime.textContent = `${kpi.avgWaktu.toFixed(1)} jam`;

    // Queue / Backlog (mock: Tertunda = backlog)
    const done = filtered.filter((r) => r.status === 'Selesai').length;
    const backlog = filtered.filter((r) => r.status !== 'Selesai').length;
    els.queueDone.textContent = String(done);
    els.queueBacklog.textContent = String(backlog);

    // Chart
    renderChart(filtered);

    // Table
    renderTable(filtered);
  }

  function exportCSV() {
    const data = window.MOCK_LAB?.pemeriksaan || [];
    const filtered = applyFilters(data);

    if (!filtered.length) {
      els.exportNote.textContent = 'Tidak ada data untuk diekspor.';
      return;
    }

    const header = [
      'id',
      'tanggalMasuk',
      'tanggalSelesai',
      'shift',
      'jenisPemeriksaan',
      'lokasiSampel',
      'status',
      'waktuProsesJam',
      'targetSLAJam',
      'slaKepatuhan',
    ];

    const escapeCsv = (v) => {
      const s = String(v ?? '');
      // wrap with quotes if contains delimiter or newline
      if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
      return s;
    };

    const rows = filtered.map((r) => {
      return [
        r.id,
        r.tanggalMasuk,
        r.tanggalSelesai,
        r.shift,
        r.jenisPemeriksaan,
        r.lokasiSampel,
        r.status,
        r.waktuProsesJam,
        r.targetSLAJam,
        r.slaKepatuhan,
      ].map(escapeCsv).join(',');
    });

    const csv = [header.join(','), ...rows].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    const now = new Date();
    const stamp = now.toISOString().slice(0, 19).replace(/:/g, '-');
    a.href = url;
    a.download = `rekap_lab_${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);
    els.exportNote.textContent = `CSV diekspor: ${filtered.length} baris.`;
  }

  function setDefaultDateRange() {
    const data = window.MOCK_LAB?.pemeriksaan || [];
    if (!data.length) return;

    // min/max tanggalMasuk
    const dates = data.map((r) => r.tanggalMasuk).sort();
    const min = dates[0];
    const max = dates[dates.length - 1];
    els.fromDate.value = min;
    els.toDate.value = max;
  }

  function initSelects() {
    const jenisSelect = els.jenis;
    const jenisList = window.MOCK_LAB?.pemeriksaanJenis || [];

    // placeholder
    jenisSelect.innerHTML = '<option value="Semua">Semua Jenis</option>';

    for (const j of jenisList) {
      const opt = document.createElement('option');
      opt.value = j.id;
      opt.textContent = j.nama;
      jenisSelect.appendChild(opt);
    }

    // shift
    els.shift.innerHTML = `
      <option value="Semua">Semua Shift</option>
      <option value="Pagi">Pagi</option>
      <option value="Sore">Sore</option>
    `;
  }

  function initSorting() {
    const headers = document.querySelectorAll('th[data-sort]');
    headers.forEach((th) => {
      th.style.cursor = 'pointer';
      th.addEventListener('click', () => {
        const key = th.getAttribute('data-sort');
        if (!key) return;
        if (state.sortKey === key) {
          state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
        } else {
          state.sortKey = key;
          state.sortDir = 'desc';
        }
        updateAll();
      });
    });
  }

  function wireEvents() {
    const inputs = [els.fromDate, els.toDate, els.shift, els.jenis, els.search, els.chartMode];
    inputs.forEach((el) => {
      el.addEventListener('input', () => updateAll());
      el.addEventListener('change', () => updateAll());
    });

    els.exportBtn.addEventListener('click', exportCSV);
  }

  function init() {
    // guard
    if (!window.MOCK_LAB) {
      els.emptyState.style.display = 'block';
      els.emptyState.textContent = 'Data mock belum tersedia.';
      return;
    }

    initSelects();
    setDefaultDateRange();
    initSorting();
    wireEvents();
    updateAll();
  }

  // expose for debugging
  window.__LAB_DASH = { updateAll };

  document.addEventListener('DOMContentLoaded', init);
})();

