const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1024,
    height: 1024,
    useContentSize: true,
    show: false,
    frame: false,
    transparent: true,
    webPreferences: { offscreen: false },
  });

  await win.loadFile(path.join(__dirname, 'icon-source.html'));
  await new Promise((r) => setTimeout(r, 200));

  const image = await win.webContents.capturePage();
  const outPath = path.join(__dirname, '..', 'build', 'icon-source.png');
  fs.writeFileSync(outPath, image.toPNG());
  console.log('Wrote', outPath, image.getSize());

  app.quit();
});
