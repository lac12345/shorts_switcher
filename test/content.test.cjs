const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../extension/content.js'), 'utf8');

async function setup(pathname = '/shorts/first') {
  const handlers = new Map();
  let clicks = 0, refresh, change;
  const video = {
    currentTime: 0, duration: 10, seeking: false,
    addEventListener: (name, fn) => handlers.set(name, fn),
    removeEventListener: name => handlers.delete(name)
  };
  const location = {pathname};
  vm.runInNewContext(source, {
    location, console,
    document: {querySelector: selector => selector.includes('[is-active]')
      ? {querySelector: () => video} : {click: () => clicks++, getAttribute: () => null}},
    browser: {storage: {
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

test('seeking does not trigger a loop transition', async () => {
  const app = await setup();
  app.video.currentTime = 9.8; app.emit('timeupdate');
  app.video.seeking = true; app.video.currentTime = 0; app.emit('timeupdate');
  assert.equal(app.clicks(), 0);
});
