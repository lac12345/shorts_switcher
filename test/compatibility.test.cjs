const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');

test('Chromium package uses Manifest V3 and contains the current shared scripts', () => {
  const chromium = JSON.parse(fs.readFileSync(path.join(root, 'extension-chromium/manifest.json')));
  const firefox = JSON.parse(fs.readFileSync(path.join(root, 'extension/manifest.json')));
  assert.equal(chromium.manifest_version, 3);
  assert.equal(chromium.version, firefox.version);
  assert.equal(chromium.browser_specific_settings, undefined);
  assert.equal(chromium.browser_action, undefined);
  assert.deepEqual(chromium.action, firefox.browser_action);
  assert.deepEqual(chromium.permissions, ['storage']);
  for (const file of ['content.js', 'popup.html', 'popup.js']) {
    assert.equal(fs.readFileSync(path.join(root, 'extension', file), 'utf8'),
      fs.readFileSync(path.join(root, 'extension-chromium', file), 'utf8'));
  }
  for (const file of [...chromium.content_scripts.flatMap(script => script.js), chromium.action.default_popup]) {
    assert.ok(fs.existsSync(path.join(root, 'extension-chromium', file)));
  }
});

for (const api of ['browser', 'chrome']) {
  test(`popup reads and saves the toggle using ${api}.storage`, async () => {
    const checkbox = {disabled: true};
    let onChange, saved;
    checkbox.addEventListener = (event, handler) => { onChange = handler; };
    const status = {};
    vm.runInNewContext(fs.readFileSync(path.join(root, 'extension/popup.js'), 'utf8'), {
      document: {querySelector: selector => selector === '#enabled' ? checkbox : status},
      [api]: {storage: {local: {
        get: async () => ({enabled: true}),
        set: async value => { saved = value.enabled; }
      }}}
    });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(checkbox.checked, true);
    assert.equal(checkbox.disabled, false);
    checkbox.checked = false;
    await onChange();
    assert.equal(saved, false);
    assert.equal(checkbox.disabled, false);
    assert.equal(status.textContent, 'Выключено');
  });
}
