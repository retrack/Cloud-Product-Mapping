#!/usr/bin/env python3
"""Download and extract the official cloud icon packs into .cache/icon-packs/ (git-ignored).

Only needed to (re)assign product icons; the icons actually used are committed
under icons/<provider>/. URLs change when vendors publish new releases: if a
download fails, get the current link from the page listed next to it.

  aws      https://aws.amazon.com/architecture/icons/
  azure    https://learn.microsoft.com/azure/architecture/icons/
  gcp      https://cloud.google.com/icons
  oracle   https://docs.oracle.com/iaas/Content/General/Reference/graphicsfordiagrams.htm
           (draw.io library → SVG with scripts/extract_oci_icons.py)
  exoscale https://community.exoscale.com/tools/icon-table/ (inline SVGs, already in icons/exoscale/)

Usage:
  python3 scripts/fetch_icon_packs.py            # all packs
  python3 scripts/fetch_icon_packs.py azure gcp  # some packs
"""

import sys
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / ".cache" / "icon-packs"
UA = "Mozilla/5.0 (cloud-product-mapping icon fetcher)"

PACKS = {
    "aws": [
        "https://d1.awsstatic.com/onedam/marketing-channels/website/public/shared/architecture-icon-release/"
        "Icon-package_07312026.5846e92413caa21490223536cc97f1269e44fa92.zip",
    ],
    "azure": ["https://arch-center.azureedge.net/icons/Azure_Public_Service_Icons_V24.zip"],
    "gcp": [
        "https://services.google.com/fh/files/misc/core-products-icons.zip",
        "https://services.google.com/fh/files/misc/google-cloud-legacy-icons.zip",
    ],
    "oracle": ["https://docs.oracle.com/iaas/Content/Resources/Assets/OCI-Style-Guide-for-Drawio.zip"],
}


def fetch(url, dest):
    request = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(request, timeout=120) as response, open(dest, "wb") as out:
        out.write(response.read())


def main():
    names = sys.argv[1:] or list(PACKS)
    for name in names:
        if name not in PACKS:
            sys.exit(f"unknown pack '{name}' (known: {', '.join(PACKS)})")
        target = CACHE / name
        target.mkdir(parents=True, exist_ok=True)
        for url in PACKS[name]:
            archive = target / url.rsplit("/", 1)[-1]
            print(f"{name}: downloading {url}")
            fetch(url, archive)
            with zipfile.ZipFile(archive) as z:
                z.extractall(target / archive.stem)
            print(f"{name}: extracted to {(target / archive.stem).relative_to(ROOT)}")


if __name__ == "__main__":
    main()
