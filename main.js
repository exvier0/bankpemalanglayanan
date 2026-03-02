const { app, BrowserWindow, ipcMain } = require('electron');

let mainWindow;

app.on('ready', () => {
  mainWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    fullscreen: true, // Biar tampilannya full layar nutupin Windows
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  // Load web Abang yang lagi jalan
  mainWindow.loadURL('http://localhost:3000/'); // Load index.html 
});

// Ini otak buat "Silent Print" (ngeprint tanpa jendela Chrome)
ipcMain.on('print-struk', (event, printerName) => {
  mainWindow.webContents.print({
    silent: true, // Kuncinya di sini!
    printBackground: true,
    deviceName: printerName || 'RP58 Printer(2)', // gunakan nama yang dikirim, fallback bila kosong
    margins: { marginType: 'none' }
  }, (success, failureReason) => {
    if (!success) console.log('Gagal print:', failureReason);
    else console.log('Berhasil nge-print!');
  });
});