#!/usr/bin/env python3
"""Export the official OCI icons from Oracle's draw.io library to standalone SVGs.

Oracle publishes its architecture icons as a draw.io library ("OCI Style Guide
for Drawio", docs.oracle.com → Graphics for Topologies and Diagrams). This script
writes one .drawio file per service icon (text labels removed) and exports them
all to SVG with the draw.io desktop CLI, which renders the stencils exactly.

Requires the draw.io desktop app CLI (`drawio`, e.g. `brew install --cask drawio`).

Usage:
  python3 scripts/extract_oci_icons.py "OCI Library.xml" out_dir/
"""

import base64
import json
import re
import shutil
import subprocess
import sys
import tempfile
import urllib.parse
import xml.etree.ElementTree as ET
import zlib
from pathlib import Path


def inflate(data):
    return urllib.parse.unquote(zlib.decompress(base64.b64decode(data), -15).decode("utf-8"))


def slug(text):
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def strip_labels(graph_xml):
    """Remove text-only label cells and clear remaining cell labels."""
    root = ET.fromstring(graph_xml)
    parents = {c.get("parent") for c in root.iter("mxCell")}
    for holder in list(root.iter()):
        for cell in list(holder):
            if cell.tag != "mxCell" or not cell.get("value"):
                continue
            if "fillColor=none" in (cell.get("style") or "") and cell.get("id") not in parents:
                holder.remove(cell)
            else:
                cell.set("value", "")
    return ET.tostring(root, encoding="unicode")


def main():
    library, out_dir = Path(sys.argv[1]), Path(sys.argv[2])
    drawio = shutil.which("drawio") or "/Applications/draw.io.app/Contents/MacOS/draw.io"
    if not Path(drawio).exists():
        sys.exit("draw.io CLI not found (install the draw.io desktop app).")

    text = library.read_text(encoding="utf-8")
    entries = json.loads(re.search(r"<mxlibrary>(.*)</mxlibrary>", text, re.S).group(1))
    out_dir.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        count = 0
        for entry in entries:
            title = (entry.get("title") or "").replace("&amp;nbsp;", " ")
            # Service icons only ("Category - Service"), not grouping/connector/example templates.
            if not title or title.startswith(("Logical", "Physical")):
                continue
            name = slug(title)
            graph = strip_labels(inflate(entry["xml"]))
            (Path(tmp) / f"{name}.drawio").write_text(
                f'<mxfile><diagram name="{name}">{graph}</diagram></mxfile>', encoding="utf-8"
            )
            count += 1
        subprocess.run(
            [drawio, "-x", "-f", "svg", "--transparent", "-o", f"{out_dir}/", f"{tmp}/"],
            check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        )
    print(f"exported {count} icons to {out_dir}")


if __name__ == "__main__":
    main()
