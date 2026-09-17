#!/usr/bin/env python3
"""Render the generated posters (docs/poster*.html) to PNG and PDF with headless Chromium/Chrome.

Run scripts/build.py first. Outputs (repository root):
  CloudProductMapping.png / CloudProductMapping-light.png
  Cloud Product Mapping.pdf / Cloud Product Mapping - light.pdf
  CloudProductMappingBrief.png / CloudProductMappingBrief-light.png
  Cloud Product Mapping - Brief.pdf / Cloud Product Mapping - Brief - light.pdf

Browser: $CHROME, else chromium / google-chrome / Google Chrome.app.
Examples:
  python3 scripts/render.py
  python3 scripts/render.py --only brief --themes dark --scale 1
"""

import argparse
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

VARIANTS = {
    "full": ("docs/poster.html", "CloudProductMapping", "Cloud Product Mapping"),
    "brief": ("docs/poster-brief.html", "CloudProductMappingBrief", "Cloud Product Mapping - Brief"),
}


def find_browser():
    candidates = [
        os.environ.get("CHROME"),
        shutil.which("chromium"),
        shutil.which("chromium-browser"),
        shutil.which("google-chrome"),
        "/Applications/Chromium.app/Contents/MacOS/Chromium",
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    ]
    for c in candidates:
        if c and Path(c).exists():
            return c
    sys.exit("No Chromium/Chrome found. Set CHROME=/path/to/browser.")


def run(browser, profile, *args, timeout=180):
    cmd = [
        browser, "--headless", "--disable-gpu", "--hide-scrollbars", "--no-first-run",
        "--no-default-browser-check", "--allow-file-access-from-files",
        f"--user-data-dir={profile}", *args,
    ]
    return subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)


def poster_size(browser, profile, url):
    result = run(browser, profile, "--virtual-time-budget=5000", "--window-size=4000,2000", "--dump-dom", url)
    m = re.search(r'data-width="(\d+)"[^>]*data-height="(\d+)"', result.stdout)
    if not m:
        sys.exit(f"Could not measure poster size for {url}:\n{result.stderr[-2000:]}")
    return int(m.group(1)), int(m.group(2))


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--only", choices=sorted(VARIANTS), help="render only this poster")
    parser.add_argument("--themes", default="dark,light", help="comma-separated: dark,light")
    parser.add_argument("--scale", type=float, default=2, help="PNG device scale factor (default 2)")
    parser.add_argument("--no-pdf", action="store_true")
    parser.add_argument("--no-png", action="store_true")
    args = parser.parse_args()

    browser = find_browser()
    variants = [args.only] if args.only else list(VARIANTS)
    themes = [t.strip() for t in args.themes.split(",") if t.strip()]

    with tempfile.TemporaryDirectory() as profile:
        for key in variants:
            page, png_base, pdf_base = VARIANTS[key]
            source = ROOT / page
            if not source.exists():
                sys.exit(f"{page} not found — run scripts/build.py first")
            for theme in themes:
                url = f"{source.as_uri()}?theme={theme}"
                suffix_png = "" if theme == "dark" else "-light"
                suffix_pdf = "" if theme == "dark" else " - light"
                width, height = poster_size(browser, profile, url)
                if not args.no_png:
                    out = ROOT / f"{png_base}{suffix_png}.png"
                    run(browser, profile, f"--window-size={width},{height}",
                        f"--force-device-scale-factor={args.scale}", f"--screenshot={out}", url)
                    print(f"wrote {out.name} ({width}x{height} @{args.scale}x)")
                if not args.no_pdf:
                    out = ROOT / f"{pdf_base}{suffix_pdf}.pdf"
                    run(browser, profile, "--virtual-time-budget=5000", "--no-pdf-header-footer",
                        "--print-to-pdf-no-header", f"--print-to-pdf={out}", url)
                    print(f"wrote {out.name}")


if __name__ == "__main__":
    main()
