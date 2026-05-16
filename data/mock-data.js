// Mock data untuk Prototype Dashboard Lab Kesehatan Daerah
// Struktur dibuat agar mudah diganti dengan data asli (Excel/Sheets/DB) nantinya.

(function () {
  const pemeriksaanJenis = [
    { id: 'HEM', nama: 'Hematologi', unit: 'sampel' },
    { id: 'MIK', nama: 'Mikrobiologi', unit: 'sampel' },
    { id: 'SER', nama: 'Serologi', unit: 'sampel' },
    { id: 'BIO', nama: 'Biokimia', unit: 'sampel' },
  ];

  const shifts = ['Pagi', 'Sore'];
  const lokasi = ['Ruang Pengambilan Sampel', 'Rujukan Puskesmas', 'IGD'];
  const statusSLA = ['Tepat Waktu', 'Terlambat'];

  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function pick(arr) {
    return arr[randInt(0, arr.length - 1)];
  }

  function formatDateISO(d) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  // SLA target (jam) per jenis (mock)
  const slaJamByJenis = {
    HEM: 6,
    MIK: 24,
    SER: 12,
    BIO: 8,
  };

  // Membuat data 30 hari terakhir
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const start = new Date(today);
  start.setDate(start.getDate() - 29);

  const pemeriksaan = [];
  let idCounter = 1;

  for (let i = 0; i < 30; i++) {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    const isoDate = formatDateISO(day);

    // Jumlah per hari bervariasi
    const jumlahItem = randInt(18, 40);

    for (let j = 0; j < jumlahItem; j++) {
      const jenis = pick(pemeriksaanJenis);
      const shift = pick(shifts);
      const lokasiSampel = pick(lokasi);

      // waktu proses aktual (jam)
      // bias agar ada mix tepat waktu & terlambat
      const sla = slaJamByJenis[jenis.id] ?? 12;
      const terlambatProb = jenis.id === 'MIK' ? 0.25 : 0.18;

      const tepatWaktu = Math.random() > terlambatProb;
      const waktuProsesJam = tepatWaktu
        ? randInt(Math.max(1, Math.floor(sla * 0.35)), Math.max(2, Math.floor(sla * 0.95)))
        : randInt(Math.max(2, Math.floor(sla * 1.05)), Math.max(3, Math.floor(sla * 1.9)));

      const status = tepatWaktu ? 'Selesai' : 'Tertunda';

      const jamMulai = shift === 'Pagi' ? randInt(7, 10) : randInt(13, 16);
      const jamSelesai = jamMulai + waktuProsesJam;

      // Simulasi jam selesai melewati hari (untuk realistic SLA)
      const selesaiTanggal = new Date(day);
      selesaiTanggal.setDate(day.getDate());
      selesaiTanggal.setHours(0, 0, 0, 0);
      selesaiTanggal.setHours(jamSelesai % 24);
      // jika melewati 24h, geser tanggal
      const daysShift = Math.floor(jamSelesai / 24);
      selesaiTanggal.setDate(selesaiTanggal.getDate() + daysShift);

      const isoTanggalSelesai = formatDateISO(selesaiTanggal);

      const slaLabel = tepatWaktu ? statusSLA[0] : statusSLA[1];

      pemeriksaan.push({
        id: `LKS-${String(idCounter++).padStart(4, '0')}`,
        tanggalMasuk: isoDate,
        shift,
        lokasiSampel,
        jenisPemeriksaan: jenis.nama,
        jenisPemeriksaanId: jenis.id,
        targetSLAJam: sla,
        jamMulai: `${String(jamMulai).padStart(2, '0')}:00`,
        tanggalSelesai: isoTanggalSelesai,
        jamSelesai: `${String(jamSelesai % 24).padStart(2, '0')}:00`,
        waktuProsesJam,
        status: tepatWaktu ? 'Selesai' : 'Tertunda',
        slaKepatuhan: slaLabel,
      });
    }
  }

  // Membuat ringkasan antrian: ambil item yang statusnya Tertunda sebagai backlog
  // (mock sederhana)
  const data = {
    pemeriksaan,
    pemeriksaanJenis,
    shifts,
  };

  // expose ke window
  window.MOCK_LAB = data;
})();

