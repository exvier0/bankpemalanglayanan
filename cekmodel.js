const API_KEY = "AIzaSyC7ubIYw5_czkQPhctXnBzoTcWtN2M7TFE";
const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`;

console.log("Sedang bertanya ke Google...");

fetch(url)
  .then(response => response.json())
  .then(data => {
    if (data.error) {
      console.error("❌ ERROR AKUN:", data.error.message);
    } else {
      console.log("✅ DAFTAR MODEL YANG TERSEDIA:");
      console.log("-----------------------------");
      // Kita cari model yang support 'generateContent'
      const available = data.models.filter(m => m.supportedGenerationMethods.includes("generateContent"));
      
      available.forEach(m => {
        console.log("NAMA MODEL:", m.name); // Ini yang kita butuhkan!
      });
      console.log("-----------------------------");
    }
  })
  .catch(err => console.error("Gagal koneksi:", err));