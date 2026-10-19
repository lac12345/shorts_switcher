// Keep a ready-to-load Chromium build in the repository for ZIP downloads.
const fs = require('node:fs');
const path = require('node:path');
const source = path.join(__dirname, '../extension-firefox');
const target = path.join(__dirname, '../extension-chromium');
fs.mkdirSync(target, {recursive: true});
const manifest = JSON.parse(fs.readFileSync(path.join(source, 'manifest.json'), 'utf8'));
manifest.manifest_version = 3;
manifest.action = manifest.browser_action;
manifest.minimum_chrome_version = '95';
delete manifest.browser_action;
delete manifest.browser_specific_settings;
fs.writeFileSync(path.join(target, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
for (const file of ['content.js', 'popup.html', 'popup.js']) {
  fs.copyFileSync(path.join(source, file), path.join(target, file));
}
