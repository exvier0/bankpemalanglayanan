const xlsx = require('xlsx');
const fs = require('fs');

// Nama file
const FILE_NAME = 'data.xlsx';

// Data awal (Header saja)
// Sesuaikan kata-kata di dalam tanda kutip dengan 'name' di HTML form kamu
const dataAwal = [
    { "nama": "Contoh User", "bintang": "5", "saran": "Tes data pertama", "Tanggal": "Sekarang" }
];

// Buat Workbook baru
const wb = xlsx.utils.book_new();
const ws = xlsx.utils.json_to_sheet(dataAwal);

// Masukkan data ke workbook
xlsx.utils.book_append_sheet(wb, ws, "Data");

// Tulis file
try {
    xlsx.writeFile(wb, FILE_NAME);
    console.log("✅ BERHASIL! File data.xlsx sudah dibuat.");
    console.log("Lokasi: " + __dirname + "\\" + FILE_NAME);
} catch (error) {
    console.error("❌ GAGAL! Error:", error);
}