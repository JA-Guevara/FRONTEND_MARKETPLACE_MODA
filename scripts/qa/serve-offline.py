"""Sirve exclusivamente el build local para ensayar su service worker."""
import os
from pathlib import Path
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

build = Path(__file__).resolve().parents[2] / "dist/browser"
if not (build / "ngsw-worker.js").is_file():
    raise SystemExit("Ejecutá npm run build antes del ensayo.")
os.chdir(build)


class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if not Path(self.translate_path(self.path)).exists() and "." not in self.path.rsplit("/", 1)[-1]:
            self.path = "/index.html"
        super().do_GET()

    def log_message(self, *args):
        pass


ThreadingHTTPServer(("127.0.0.1", 57520), Handler).serve_forever()
