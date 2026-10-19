const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../extension-firefox/content.js'), 'utf8');

async function setup(pathname = '/shorts/first', options = {}) {
  const handlers = new Map();
  let clicks = 0, refresh, change;
  const button = {click: () => clicks++, getAttribute: () => null,
    getClientRects: () => options.hiddenButton ? [] : [{}]};
  const renderer = {nextElementSibling: options.nextRenderer ? {
    matches: () => true, scrollIntoView: () => clicks++
  } : null};
  const video = {
    currentTime: 0, duration: 10, seeking: false, paused: false,
    closest: () => renderer,
    getBoundingClientRect: () => ({width: 300, height: 600, top: 0, bottom: 600, left: 0, right: 300}),
    addEventListener: (name, fn) => handlers.set(name, fn),
    removeEventListener: name => handlers.delete(name)
  };
  const location = {pathname};
  vm.runInNewContext(source, {
    location, console, innerHeight: 900, innerWidth: 1200,
    document: {
      querySelectorAll: selector => selector === 'video' ? [video] : [],
      querySelector: selector => selector === (options.buttonSelector || '#navigation-button-down button')
        ? button : null
    },
    [options.apiName || 'browser']: {storage: {
      local: {get: async () => ({enabled: true})},
      onChanged: {addListener: fn => {change = fn;}}
    }},
    setInterval: fn => {refresh = fn;}
  });
  await new Promise(resolve => setImmediate(resolve));
  return {video, location, handlers, clicks: () => clicks,
    refresh: () => refresh(),
    enable: value => change({enabled: {newValue: value}}, 'local'),
    emit: name => handlers.get(name)?.()};
}

test('ended advances once; new Short rearms even with reused video', async () => {
  const app = await setup();
  app.emit('ended'); app.emit('ended');
  assert.equal(app.clicks(), 1);
  app.location.pathname = '/shorts/second'; app.refresh(); app.emit('ended');
  assert.equal(app.clicks(), 2);
});

test('loop wrap advances, but approaching the end does not', async () => {
  const app = await setup();
  app.video.currentTime = 9.8; app.emit('timeupdate');
  assert.equal(app.clicks(), 0);
  app.video.currentTime = 0.1; app.emit('timeupdate');
  assert.equal(app.clicks(), 1);
});

test('disabled setting detaches listeners and can be reenabled', async () => {
  const app = await setup();
  app.enable(false); app.emit('ended');
  assert.equal(app.handlers.size, 0); assert.equal(app.clicks(), 0);
  app.enable(true); app.emit('ended');
  assert.equal(app.clicks(), 1);
});

test('ordinary videos ignored; client navigation activates Shorts only', async () => {
  const app = await setup('/watch');
  app.emit('ended'); assert.equal(app.clicks(), 0);
  app.location.pathname = '/shorts/first'; app.refresh();
  app.emit('ended'); assert.equal(app.clicks(), 1);
  app.location.pathname = '/watch'; app.refresh();
  assert.equal(app.handlers.size, 0);
});

test('seeking from the middle does not trigger a loop transition', async () => {
  const app = await setup();
  app.video.currentTime = 5; app.emit('timeupdate');
  app.video.seeking = true; app.video.currentTime = 0; app.emit('timeupdate');
  assert.equal(app.clicks(), 0);
});


test('loop reset while seeking is detected without losing the final playback time', async () => {
  const app = await setup();
  app.video.currentTime = 9.6; app.emit('timeupdate');
  app.video.currentTime = 0; app.video.seeking = true; app.emit('timeupdate');
  app.video.seeking = false; app.emit('seeked');
  assert.equal(app.clicks(), 1);
});

test('supports a player outside ytd-shorts and newer navigation ID', async () => {
  const app = await setup('/shorts/first', {buttonSelector: '#shorts-navigation-button-down button'});
  app.emit('ended');
  assert.equal(app.clicks(), 1);
});

test('hidden navigation uses next renderer scrolling', async () => {
  const app = await setup('/shorts/first', {hiddenButton: true, nextRenderer: true});
  app.emit('ended');
  assert.equal(app.clicks(), 1);
});

test('paused video does not advance on time changes', async () => {
  const app = await setup();
  app.video.currentTime = 9.8; app.emit('timeupdate');
  app.video.paused = true; app.video.currentTime = 0; app.emit('timeupdate');
  assert.equal(app.clicks(), 0);
});


test('Chromium chrome.storage API supports switching and disabling', async () => {
  const app = await setup('/shorts/first', {apiName: 'chrome'});
  app.emit('ended');
  assert.equal(app.clicks(), 1);
  app.location.pathname = '/shorts/second'; app.refresh();
  app.enable(false); app.emit('ended');
  assert.equal(app.clicks(), 1);
});
