#!/usr/bin/env python3
"""Zero-dependency static server for prototypes with no-store caching and hot reload.

`python3 -m http.server` sends Last-Modified but no Cache-Control, so browsers
heuristically cache CSS/JS and revalidate to 304 — which means an open tab can keep
rendering old CSS against new HTML after an edit. no-store removes that class of bug.

Usage:
  python3 serve.py [port]              # no-store static serving (default: 4173)
  python3 serve.py [port] --reload     # also exposes /__reload__ for live reload
"""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from datetime import datetime, timezone
import hashlib
import json
import os
import sys
import threading

_ANNOTATIONS_LOCK = threading.Lock()
_ANNOTATIONS_FILE = ".annotations.json"

RELOAD = "--reload" in sys.argv
PORT = 4173
for arg in sys.argv[1:]:
    if arg != "--reload":
        try:
            PORT = int(arg)
        except ValueError:
            pass

_EXCLUDE_NAMES = {
    "serve.py",
    ".proto.json",
    ".archived",
    ".suite",
    ".annotations.json",
    ".DS_Store",
}
_EXCLUDE_SUFFIXES = (".log", ".tmp")
_EXCLUDE_DIRS = {".git", "__pycache__", "node_modules"}


def _tree_signature(root="."):
    """Hash of (path, mtime, size) across the served tree.
    Sorted order ensures deterministic hashing regardless of OS traversal.
    """
    h = hashlib.sha256()
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = sorted(d for d in dirnames if d not in _EXCLUDE_DIRS)
        for name in sorted(filenames):
            if name in _EXCLUDE_NAMES or name.endswith(_EXCLUDE_SUFFIXES):
                continue
            path = os.path.join(dirpath, name)
            try:
                st = os.stat(path)
            except OSError:
                continue
            h.update(path.encode())
            h.update(str(st.st_mtime_ns).encode())
            h.update(str(st.st_size).encode())
    return h.hexdigest()


def _validate_event(evt):
    """Validate annotation event structure."""
    if not isinstance(evt, dict):
        return "body must be a JSON object"
    if not isinstance(evt.get("prototype"), str) or not evt["prototype"]:
        return "prototype is required"
    if evt.get("event") not in ("created", "edited", "status"):
        return "event must be one of created, edited, status"
    comment = evt.get("comment")
    if not isinstance(comment, dict):
        return "comment must be a JSON object"
    if not isinstance(comment.get("id"), str) or not comment["id"]:
        return "comment.id is required"
    return None


def _apply_event(evt):
    """Upsert one comment into .annotations.json by id."""
    comment = evt["comment"]
    with _ANNOTATIONS_LOCK:
        existing = []
        if os.path.exists(_ANNOTATIONS_FILE):
            try:
                with open(_ANNOTATIONS_FILE, encoding="utf-8") as fh:
                    prior = json.load(fh)
                if isinstance(prior.get("comments"), list):
                    existing = prior["comments"]
            except (ValueError, OSError):
                try:
                    os.replace(_ANNOTATIONS_FILE, _ANNOTATIONS_FILE + ".corrupt")
                except OSError:
                    pass

        replaced = False
        for i, c in enumerate(existing):
            if isinstance(c, dict) and c.get("id") == comment["id"]:
                existing[i] = comment
                replaced = True
                break
        if not replaced:
            existing.append(comment)

        payload = {
            "prototype": evt["prototype"],
            "protoVersion": evt.get("protoVersion", "unknown"),
            "savedAt": datetime.now(timezone.utc).isoformat(),
            "comments": existing,
        }
        tmp = _ANNOTATIONS_FILE + ".tmp"
        with open(tmp, "w", encoding="utf-8") as fh:
            json.dump(payload, fh, indent=2, ensure_ascii=False)
        os.replace(tmp, _ANNOTATIONS_FILE)
        return len(existing)


def _forward_webhook(evt):
    """Forward event to configured webhook URL if present in environment."""
    webhook_url = os.environ.get("PROTO_WEBHOOK_URL") or os.environ.get("WEBHOOK_URL")
    if not webhook_url:
        return None

    import urllib.request
    import urllib.error

    req = urllib.request.Request(
        webhook_url,
        data=json.dumps(evt).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=5) as res:
            return 200 <= res.status < 300
    except (urllib.error.URLError, OSError, ValueError):
        return False


class NoCacheHandler(SimpleHTTPRequestHandler):
    def send_head(self):
        del self.headers["If-Modified-Since"]
        del self.headers["If-None-Match"]
        return super().send_head()

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def do_GET(self):
        if RELOAD and self.path == "/__reload__":
            body = _tree_signature().encode()
            self.send_response(200)
            self.send_header("Content-Type", "text/plain")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()

    def _json(self, code, obj):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        """POST /api/comments — save review feedback."""
        if self.path != "/api/comments":
            self._json(404, {"error": "endpoint not found; comments post to /api/comments"})
            return
        try:
            length = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            self._json(400, {"error": "bad Content-Length"})
            return
        if length <= 0 or length > 2_000_000:
            self._json(413, {"error": "payload too large or empty"})
            return
        try:
            evt = json.loads(self.rfile.read(length).decode("utf-8"))
        except (ValueError, OSError) as exc:
            self._json(400, {"error": f"invalid JSON: {exc}"})
            return

        problem = _validate_event(evt)
        if problem:
            self._json(400, {"error": problem})
            return

        try:
            count = _apply_event(evt)
        except OSError as exc:
            self._json(500, {"error": f"could not write annotations: {exc}"})
            return

        forwarded = _forward_webhook(evt)
        out = {"ok": True, "stored": True, "count": count, "id": evt["comment"]["id"]}
        if forwarded is not None:
            out["forwarded"] = forwarded
        self._json(202, out)


if __name__ == "__main__":
    mode = "no-store, live-reload" if RELOAD else "no-store"
    print(f"Serving prototype on http://localhost:{PORT} ({mode})")
    try:
        ThreadingHTTPServer(("127.0.0.1", PORT), NoCacheHandler).serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")
