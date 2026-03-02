const express = require('express');
const bodyParser = require('body-parser');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const session = require('express-session');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
const PORT = 3000;
const FILE_NAME = 'data.xlsx';
const CRED_FILE = 'credentials.json'; 

// --- KONFIGURASI AI ---
// API Key ini yang kamu kasih tadi
const GEN_API_KEY = "AIzaSyAOy_aVMb1I8wkzjfJr7f8DXe52wQEW534";
const genAI = new GoogleGenerativeAI(GEN_API_KEY);

// --- DATA INFORMASI BANK PEMALANG (OTAK UTAMA) ---
const instruksiSistem = `
Kamu adalah CS Virtual profesional dari PT BPR Bank Pemalang (Perseroda), yang melayani dengan ramah dan profesional.
Berikan jawaban SPESIFIK, DETAIL, dan MEMBANTU untuk setiap pertanyaan nasabah.

INFORMASI LENGKAP BANK PEMALANG:

KONTAK & LOKASI:
- Kantor Pusat: Komplek Pasar Kota Blok D No. 1, Jl. Jendral Sudirman, Mulyoharjo, Pemalang
- Telepon: (0284) 321937
- Email: bankpemalang@gmail.com
- Jam Kerja: Senin-Jumat 08.00-15.00 WIB (Libur Sabtu-Minggu & Hari Libur Nasional)

PRODUK TABUNGAN:
- Tabungan Umum: Bunga 2-3% per tahun, setoran awal Rp50.000
- Tabungan Pelajar: Khusus pelajar, bunga 2% per tahun, setoran awal Rp20.000
- Tabunganku: Tabungan untuk semua, bunga 2% per tahun, setoran awal Rp20.000
- Semua dijamin aman oleh LPS hingga Rp100 juta

PRODUK DEPOSITO BERJANGKA:
- Tenor: 1 bulan (2%), 3 bulan (3%), 6 bulan (4%), 12 bulan (5%) per tahun
- Minimal Penempatan: Rp1 juta
- Bunga Mencair di Akhir Tenor
- Pajak: 20% untuk saldo > Rp7,5 juta (ditanggung BI)

PRODUK KREDIT:
1. KREDIT UMUM (Konsumtif):
   - Bunga: 12-13% per tahun
   - Tenor: Hingga 60 bulan
   - Plafond: Hingga Rp500 juta
   
2. KREDIT UMKM (Modal Usaha):
   - Bunga: 10-12% per tahun  
   - Tenor: Hingga 60 bulan
   - Plafond: Hingga Rp250 juta
   
3. SYARAT UMUM:
   - KTP Suami-Istri (masih berlaku)
   - Kartu Keluarga
   - Surat Nikah (jika sudah kawin)
   - Surat Keterangan Usaha atau Bukti Penghasilan
   - Jaminan: SHM (Sertifikat Hak Milik), BPKB (Bukti Kepemilikan Kendaraan), atau Promes

KEAMANAN & PERIZINAN:
- Badan Hukum: PT BPR Bank Pemalang (Perseroda) - milik daerah Kabupaten Pemalang
- Izin OJK (Otoritas Jasa Keuangan)
- Dijamin LPS (Lembaga Penjamin Simpanan)
- Aset Sehat & Terpercaya

KEBIJAKAN LAYANAN:
- Proses cepat, transparent, dan hati-hati
- Tidak ada biaya tambahan tersembunyi
- Konsultasi GRATIS untuk setiap produk

JIKA PERTANYAAN DILUAR TOPIK BANK:
Jawab: "Maaf, saya hanya bisa membantu informasi terkait layanan dan produk Bank Pemalang. Ada yang lain yang bisa saya bantu?"
`;

app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({
    secret: 'bank-pemalang-secret',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

app.use(express.static(__dirname)); 
app.use(express.static(path.join(__dirname, 'www')));

// --- 1. SETUP LOGIN ---
if (!fs.existsSync(CRED_FILE)) {
    fs.writeFileSync(CRED_FILE, JSON.stringify({ username: "admin", password: "admin123" }, null, 2));
}

app.post('/login', (req, res) => {
    let { username, password } = req.body;
    console.log('Login attempt:', { username, password });
    const creds = JSON.parse(fs.readFileSync(CRED_FILE));
    console.log('Stored credentials:', { username: creds.username, password: '***' });
    // require both username and password to match
    if (username === creds.username && password === creds.password) {
        console.log('Login successful!');
        req.session.loggedin = true;
        res.json({ success: true });
    } else {
        console.log('Login failed!');
        res.json({ success: false, msg: 'Username atau Password Salah!' });
    }
});

// --- 2. SUBMIT DATA EXCEL ---
app.post('/submit', (req, res) => {
    if (!fs.existsSync(FILE_NAME)) {
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([]), "Data");
        XLSX.writeFile(wb, FILE_NAME);
    }
    const wb = XLSX.readFile(FILE_NAME);
    let data = XLSX.utils.sheet_to_json(wb.Sheets["Data"]);
    data.push({ Tanggal: new Date().toLocaleString("id-ID"), ...req.body });
    wb.Sheets["Data"] = XLSX.utils.json_to_sheet(data);
    XLSX.writeFile(wb, FILE_NAME);
    res.send(`<script>alert('Data Tersimpan!'); window.location.href='/';</script>`);
});

// --- 2B. API BACA DATA ---
app.get('/api/data', (req, res) => {
    try {
        if (!fs.existsSync(FILE_NAME)) {
            return res.json([]);
        }
        const wb = XLSX.readFile(FILE_NAME);
        const data = XLSX.utils.sheet_to_json(wb.Sheets["Data"] || {});
        res.json(data);
    } catch(err) {
        console.error('Error reading data:', err);
        res.json([]);
    }
});

// --- 2C. API HAPUS DATA ---
app.post('/api/delete', (req, res) => {
    try {
        const { index, match } = req.body;
        
        if (!fs.existsSync(FILE_NAME)) {
            return res.json({ success: false, msg: 'File tidak ditemukan' });
        }

        const wb = XLSX.readFile(FILE_NAME);
        let data = XLSX.utils.sheet_to_json(wb.Sheets["Data"] || {});
        let removed = false;

        // Jika index diberikan gunakan index
        if (typeof index === 'number') {
            if (index >= 0 && index < data.length) {
                data.splice(index, 1);
                removed = true;
            }
        } else if (match) {
            // cari object yang sama (sederhana dengan JSON string)
            const idx = data.findIndex(item => JSON.stringify(item) === JSON.stringify(match));
            if (idx >= 0) {
                data.splice(idx, 1);
                removed = true;
            }
        }

        if (removed) {
            wb.Sheets["Data"] = XLSX.utils.json_to_sheet(data);
            XLSX.writeFile(wb, FILE_NAME);
            res.json({ success: true, msg: 'Data berhasil dihapus' });
        } else {
            res.json({ success: false, msg: 'Index/match tidak valid' });
        }
    } catch(err) {
        console.error('Error deleting data:', err);
        res.json({ success: false, msg: 'Error: ' + err.message });
    }
});

// --- 2D. API DOWNLOAD EXCEL ---
app.get('/api/download', (req, res) => {
    try {
        if (!fs.existsSync(FILE_NAME)) {
            return res.status(404).send('File tidak ditemukan');
        }
        res.download(FILE_NAME, 'data_survey_bank_pemalang.xlsx');
    } catch(err) {
        res.status(500).send('Error: ' + err.message);
    }
});

// --- 3. API AI (LOGIKA UTAMA) ---
app.post('/api/ai', async (req, res) => {
    // Ambil prompt dan ubah ke huruf kecil biar gampang dicek
    const prompt = (req.body.prompt || '').toLowerCase(); 

    try {
        if (!prompt) return res.json({ success: false, text: "Halo! Ada yang bisa saya bantu?" });

        // Coba pakai Gemini
        const model = genAI.getGenerativeModel({ 
            model: "gemini-1.5-flash",
            systemInstruction: instruksiSistem 
        });

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const aiText = response.text();

        // Kirim jawaban AI asli
        return res.json({ success: true, text: aiText });

    } catch (err) {
        console.error('[AI ERROR]:', err.message);
        
        // --- SMART FALLBACK (JAWABAN CADANGAN PINTAR) ---
        // Urutan: PALING SPESIFIK dulu, baru UMUM
        
        let reply = "";

        // PALING SPESIFIK: Syarat + Dokumen (harus cek dulu sebelum cek "kredit" umum)
        if ((prompt.includes("syarat") && (prompt.includes("kredit") || prompt.includes("dokumen") || prompt.includes("pinjam"))) ||
            prompt.includes("dokumen") || prompt.includes("ktp") || prompt.includes("kartu keluarga") || prompt.includes("jaminan")) {
            reply = "📋 SYARAT KREDIT Bank Pemalang:\n✓ KTP Suami-Istri (masih berlaku)\n✓ Kartu Keluarga\n✓ Surat Nikah (jika sudah kawin)\n✓ Surat Keterangan Usaha/Bukti Penghasilan\n✓ Jaminan: SHM, BPKB, atau Promes\n\n💡 Tidak ada biaya tersembunyi. Konsultasi GRATIS!";
        
        // KONTAK & LOKASI
        } else if (prompt.includes("kontak") || prompt.includes("telepon") || prompt.includes("nomor") || prompt.includes("email")) {
            reply = "📞 HUBUNGI KAMI:\n• Telepon: (0284) 321937\n• Email: bankpemalang@gmail.com\n• Lokasi: Komplek Pasar Kota Blok D No. 1, Jl. Jendral Sudirman, Mulyoharjo, Pemalang\n⏰ Senin-Jumat 08.00-15.00 WIB";
        
        } else if (prompt.includes("lokasi") || prompt.includes("alamat") || prompt.includes("dimana") || prompt.includes("kantor")) {
            reply = "🏢 LOKASI BANK PEMALANG:\nKantor Pusat: Komplek Pasar Kota Blok D No. 1, Jl. Jendral Sudirman, Mulyoharjo, Pemalang\n⏰ Jam Kerja: Senin-Jumat 08.00-15.00 WIB (Libur Sabtu-Minggu & Hari Libur Nasional)";
        
        // JAM OPERASIONAL
        } else if (prompt.includes("jam") || prompt.includes("buka") || prompt.includes("tutup") || prompt.includes("operasional")) {
            reply = "🕐 JAM OPERASIONAL BANK PEMALANG:\n• SENIN - JUMAT: 08.00 - 15.00 WIB\n• SABTU, MINGGU & HARI LIBUR: TUTUP\n\n💳 Akses ATM tersedia 24 jam!";
        
        // DEPOSITO (SPESIFIK)
        } else if (prompt.includes("deposito") || (prompt.includes("bunga") && prompt.includes("bulan"))) {
            reply = "💎 DEPOSITO BERJANGKA BANK PEMALANG:\n• 1 Bulan: 2% per tahun\n• 3 Bulan: 3% per tahun\n• 6 Bulan: 4% per tahun\n• 12 Bulan: 5% per tahun\n\nMinimal Rp1 juta. Bunga ditransfer di akhir tenor. Aman dijamin LPS!";
        
        // TABUNGAN (SPESIFIK)
        } else if (prompt.includes("tabungan") && !prompt.includes("deposito")) {
            reply = "💰 PRODUK TABUNGAN BANK PEMALANG:\n1️⃣ Tabungan Umum: Bunga 2-3% per tahun, setoran awal Rp50.000\n2️⃣ Tabungan Pelajar: Khusus pelajar, bunga 2% per tahun, setoran awal Rp20.000\n3️⃣ Tabunganku: Untuk semua, bunga 2% per tahun, setoran awal Rp20.000\n\n🛡️ Semua dijamin aman LPS hingga Rp100 juta!";
        
        // KREDIT (SEMUA JENIS)
        } else if (prompt.includes("kredit") || prompt.includes("pinjam") || prompt.includes("hutang") || prompt.includes("plafond")) {
            reply = "🏦 PRODUK KREDIT BANK PEMALANG:\n\n1️⃣ KREDIT UMUM (Konsumtif):\n   • Bunga: 12-13% per tahun\n   • Tenor: Hingga 60 bulan\n   • Plafond: Hingga Rp500 juta\n\n2️⃣ KREDIT UMKM (Modal Usaha):\n   • Bunga: 10-12% per tahun\n   • Tenor: Hingga 60 bulan\n   • Plafond: Hingga Rp250 juta\n\n⚡ Proses cepat & transparan!";
        
        // BUNGA UMUM
        } else if (prompt.includes("bunga") || prompt.includes("persen") || prompt.includes("rate") || prompt.includes("%")) {
            reply = "📊 BUNGA BANK PEMALANG:\n💰 TABUNGAN: 2-3% per tahun\n💎 DEPOSITO: 2% (1bln) → 5% (12bln) per tahun\n📈 KREDIT UMUM: 12-13% per tahun\n🏢 KREDIT UMKM: 10-12% per tahun\n\n✅ Bunga kompetitif & transparan!";
        
        // PAJAK
        } else if (prompt.includes("pajak") || prompt.includes("potongan")) {
            reply = "💸 PAJAK BUNGA BANK PEMALANG:\n• Tabungan & Deposito: Pajak 20% (ditanggung BI) jika saldo/deposito > Rp7,5 juta\n• Contoh: Bunga kotor Rp100.000 → Pajak Rp20.000 → Netto Rp80.000\n• Kredit: Tidak ada pajak bunga untuk peminjam";
        
        // KEAMANAN & LEGALITAS
        } else if (prompt.includes("aman") || prompt.includes("terpercaya") || prompt.includes("legal") || prompt.includes("ojk") || prompt.includes("lps")) {
            reply = "🔒 BANK PEMALANG AMAN & TERPERCAYA:\n🏛️ Badan Hukum: PT BPR Bank Pemalang (Perseroda)\n📋 Izin: OJK (Otoritas Jasa Keuangan)\n🛡️ Jaminan: LPS (Lembaga Penjamin Simpanan) hingga Rp100 juta per rekening\n✅ Aset Sehat & Transparan\n\nBank milik daerah Kabupaten Pemalang!";
        
        // DEFAULT
        } else {
            reply = "👋 Halo! Saya CS Virtual Bank Pemalang. Saya bisa membantu Anda dengan:\n\n✓ Informasi Tabungan & Deposito\n✓ Proses & Syarat Kredit\n✓ Bunga & Biaya\n✓ Lokasi & Kontak\n✓ Keamanan Dana\n✓ Jam Operasional\n\nSilakan tanya lebih spesifik! 😊";
        }

        // Kirim jawaban cadangan
        res.json({ success: true, text: reply });
    }
});

// --- 4. RUTE ADMIN ---
app.get('/admin', (req, res) => {
    if (req.session.loggedin) {
        res.sendFile(path.join(__dirname, 'www', 'admin.html'));
    } else {
        res.redirect('/');
    }
});

// --- LOGOUT ---
app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error('Error destroying session:', err);
        }
        res.redirect('/');
    });
});

app.listen(PORT, () => {
    console.log(`\n==========================================`);
    console.log(`  Server aktif di sini bossque: http://localhost:${PORT}`);
    console.log(`==========================================\n`);
});