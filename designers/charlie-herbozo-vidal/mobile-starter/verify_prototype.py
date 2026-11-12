#!/usr/bin/env python3
"""Automated verification linter for mobile & web prototypes.

Verifies structural invariants, mobile viewport contracts, server responsiveness,
and slot rendering guarantees offline.

Usage:
  verify_prototype.py <prototype-dir> [port] [--reload]
"""
from __future__ import annotations

import argparse
import os
import re
import sys
import urllib.request
import urllib.error
from html.parser import HTMLParser
from pathlib import Path

PASS, FAIL, WARN, SKIP = "PASS", "FAIL", "WARN", "SKIP"
_ICON = {PASS: "✓", FAIL: "✗", WARN: "!", SKIP: "–"}


class PrototypeVerifier:
    def __init__(self, proto_dir: Path, port: int | None = None, check_reload: bool = False):
        self.proto_dir = proto_dir.resolve()
        self.port = port
        self.check_reload = check_reload
        self.results: list[tuple[str, str, str]] = []

    def record(self, status: str, check_name: str, detail: str = ""):
        self.results.append((status, check_name, detail))

    def run_all(self) -> int:
        print(f"\nVerifying prototype: {self.proto_dir.name}")
        print("=" * 60)

        self.check_files()
        self.check_html_structure()
        self.check_stage_contracts()

        if self.port:
            self.check_server_response()
        else:
            self.record(SKIP, "Live server check", "No port supplied; skipping HTTP checks")

        failures = 0
        for status, name, detail in self.results:
            icon = _ICON.get(status, " ")
            extra = f" ({detail})" if detail else ""
            print(f"  {icon} [{status}] {name}{extra}")
            if status == FAIL:
                failures += 1

        print("=" * 60)
        if failures == 0:
            print("✓ All critical checks passed.\n")
            return 0
        else:
            print(f"✗ Verification failed with {failures} error(s).\n")
            return 1

    def check_files(self):
        index = self.proto_dir / "index.html"
        if not index.is_file():
            self.record(FAIL, "index.html present", "Missing index.html entrypoint")
        else:
            self.record(PASS, "index.html present")

        serve = self.proto_dir / "serve.py"
        if not serve.is_file():
            self.record(WARN, "serve.py present", "Local dev server missing")
        else:
            self.record(PASS, "serve.py present")

    def check_html_structure(self):
        index = self.proto_dir / "index.html"
        if not index.is_file():
            return

        try:
            content = index.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            self.record(FAIL, "index.html encoding", "File is not valid UTF-8")
            return

        if "<!DOCTYPE html>" not in content and "<!doctype html>" not in content.lower():
            self.record(FAIL, "HTML5 doctype", "Missing <!DOCTYPE html>")
        else:
            self.record(PASS, "HTML5 doctype")

        if 'name="viewport"' not in content:
            self.record(WARN, "Viewport meta tag", "Missing mobile viewport meta tag")
        else:
            self.record(PASS, "Viewport meta tag")

        if "content-slot" in content or "device-frame__screen" in content:
            self.record(PASS, "Content slot container", "Screen content container found")
        else:
            self.record(WARN, "Content slot container", "No #content-slot or .device-frame__screen detected")

    def check_stage_contracts(self):
        # Look for CSS files
        css_files = list(self.proto_dir.glob("*.css"))
        has_box_sizing = False

        for css_path in css_files:
            try:
                css = css_path.read_text(encoding="utf-8")
                if "box-sizing: border-box" in css:
                    has_box_sizing = True
                    break
            except Exception:
                continue

        if has_box_sizing:
            self.record(PASS, "box-sizing: border-box", "Global border-box reset defined")
        else:
            self.record(WARN, "box-sizing: border-box", "Consider adding * { box-sizing: border-box; }")

    def check_server_response(self):
        url = f"http://127.0.0.1:{self.port}/"
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "PrototypeVerifier"})
            with urllib.request.urlopen(req, timeout=3) as res:
                if res.status == 200:
                    self.record(PASS, "Live server HTTP 200", f"Server running on port {self.port}")
                    cache_control = res.headers.get("Cache-Control", "")
                    if "no-store" in cache_control:
                        self.record(PASS, "Cache-Control: no-store", "Server guarantees no browser cache")
                    else:
                        self.record(WARN, "Cache-Control: no-store", f"Header was: {cache_control}")
                else:
                    self.record(FAIL, "Live server status", f"Unexpected status {res.status}")
        except Exception as e:
            self.record(FAIL, "Live server connection", str(e))

        if self.check_reload:
            reload_url = f"http://127.0.0.1:{self.port}/__reload__"
            try:
                with urllib.request.urlopen(reload_url, timeout=3) as res:
                    body = res.read().decode("utf-8").strip()
                    if res.status == 200 and len(body) == 64:  # SHA256 length
                        self.record(PASS, "Live-reload endpoint", "Valid tree signature returned")
                    else:
                        self.record(WARN, "Live-reload endpoint", f"Returned: {body[:30]}")
            except Exception as e:
                self.record(FAIL, "Live-reload endpoint", str(e))


def main():
    parser = argparse.ArgumentParser(description="Verify a mobile/web prototype.")
    parser.add_argument("proto_dir", help="Path to prototype directory")
    parser.add_argument("port", nargs="?", type=int, default=None, help="Port server is running on")
    parser.add_argument("--reload", action="store_true", help="Also verify live reload endpoint")
    args = parser.parse_args()

    dir_path = Path(args.proto_dir)
    if not dir_path.is_dir():
        print(f"Error: Directory '{args.proto_dir}' not found.", file=sys.stderr)
        sys.exit(1)

    verifier = PrototypeVerifier(dir_path, args.port, args.reload)
    code = verifier.run_all()
    sys.exit(code)


if __name__ == "__main__":
    main()
