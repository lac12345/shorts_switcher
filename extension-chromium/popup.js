"use strict";
const extensionApi = globalThis.browser ?? globalThis.chrome;
const checkbox = document.querySelector("#enabled");
const status = document.querySelector("#status");
extensionApi.storage.local.get({enabled: true}).then(({enabled}) => {
  checkbox.checked = enabled;
  checkbox.disabled = false;
}).catch(() => { status.textContent = "Не удалось прочитать настройки."; });
checkbox.addEventListener("change", async () => {
  checkbox.disabled = true;
  try {
    await extensionApi.storage.local.set({enabled: checkbox.checked});
    status.textContent = checkbox.checked ? "Включено" : "Выключено";
  } catch {
    checkbox.checked = !checkbox.checked;
    status.textContent = "Не удалось сохранить настройку.";
  } finally {
    checkbox.disabled = false;
  }
});
