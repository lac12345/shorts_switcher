"""Build a reproducible upload ZIP with the Firefox manifest at its root."""
import json
from pathlib import Path
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED

root = Path(__file__).resolve().parent.parent
source = root / "extension-firefox"
manifest = json.loads((source / "manifest.json").read_text())
target = root / "packages" / f"shorts-switcher-firefox-{manifest['version']}.zip"
target.parent.mkdir(exist_ok=True)
with ZipFile(target, "w", compression=ZIP_DEFLATED) as archive:
    for name in ("manifest.json", "content.js", "popup.html", "popup.js"):
        entry = ZipInfo(name, date_time=(2026, 1, 1, 0, 0, 0))
        entry.compress_type = ZIP_DEFLATED
        entry.external_attr = 0o100644 << 16
        archive.writestr(entry, (source / name).read_bytes())
print(target)
