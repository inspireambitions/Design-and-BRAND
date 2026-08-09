#!/usr/bin/env python3
import json
import re
import sys
import zipfile
from pathlib import Path
from urllib.parse import unquote, urljoin

ROOT = Path(__file__).resolve().parents[1]
SPRINT_ROOT = ROOT.parent / "inspire-ambitions-sprint"
sys.path.insert(0, str(SPRINT_ROOT))

from prepare_batch88_site_layer import SITE, chrome_session, rest_nonce  # noqa: E402

SLUG = "ia-career-change-roadmap-bridge"
PLUGIN_FILE = "ia-career-change-roadmap-bridge.php"
PLUGIN_REF = f"{SLUG}/{PLUGIN_FILE}"
SOURCE = ROOT / "wordpress" / SLUG / PLUGIN_FILE
ZIP_PATH = ROOT / "wordpress" / f"{SLUG}.zip"


def package():
    with zipfile.ZipFile(ZIP_PATH, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.write(SOURCE, f"{SLUG}/{PLUGIN_FILE}")


def find_link(html, needle):
    for raw in re.findall(r'href="([^"]+)"', html):
        href = unquote(raw.replace("&amp;", "&"))
        if needle in href and SLUG in href:
            return href
    return None


def absolute(href):
    return href if href.startswith("http") else urljoin(f"{SITE}/wp-admin/", href)


def upload(session):
    form = session.get(f"{SITE}/wp-admin/plugin-install.php?tab=upload", timeout=60)
    form.raise_for_status()
    match = re.search(r'name="_wpnonce"\s+value="([^"]+)"', form.text) or re.search(r'value="([^"]+)"\s+name="_wpnonce"', form.text)
    if not match:
        raise RuntimeError("Plugin upload nonce not found")
    with ZIP_PATH.open("rb") as handle:
        response = session.post(
            f"{SITE}/wp-admin/update.php?action=upload-plugin",
            data={"_wpnonce": match.group(1), "_wp_http_referer": "/wp-admin/plugin-install.php?tab=upload", "install-plugin-submit": "Install Now"},
            files={"pluginzip": (ZIP_PATH.name, handle, "application/zip")},
            headers={"Referer": form.url},
            timeout=120,
        )
    response.raise_for_status()
    html = response.text
    overwrite = find_link(html, "overwrite=update-plugin")
    if overwrite:
        replaced = session.get(absolute(overwrite), headers={"Referer": response.url}, timeout=120)
        replaced.raise_for_status()
        html = replaced.text
    activate = find_link(html, "action=activate")
    if activate:
        activated = session.get(absolute(activate), headers={"Referer": response.url}, timeout=60)
        activated.raise_for_status()


def ensure_active(session, nonce):
    response = session.get(f"{SITE}/wp-json/wp/v2/plugins?context=edit&per_page=100", headers={"X-WP-Nonce": nonce}, timeout=60)
    response.raise_for_status()
    plugin = next((item for item in response.json() if item.get("plugin") == PLUGIN_REF), None)
    if not plugin:
        raise RuntimeError("Bridge plugin was not found after upload")
    if plugin.get("status") != "active":
        encoded = PLUGIN_REF.replace("/", "%2F")
        update = session.post(f"{SITE}/wp-json/wp/v2/plugins/{encoded}", headers={"X-WP-Nonce": nonce}, json={"status": "active"}, timeout=60)
        update.raise_for_status()


def ensure_page(session, nonce):
    pages = session.get(f"{SITE}/wp-json/wp/v2/pages?slug=career-change-roadmap&status=any&context=edit&per_page=20", headers={"X-WP-Nonce": nonce}, timeout=60)
    pages.raise_for_status()
    payload = {
        "title": "AI Career Coach and Career Change Roadmap",
        "slug": "career-change-roadmap",
        "status": "publish",
        "content": "<!-- wp:paragraph --><p>Build a personalised career change roadmap across common industries, including practical skills, training checks and safe next steps.</p><!-- /wp:paragraph -->",
        "excerpt": "Build a personalised career change roadmap across warehouse, trades, care, retail, office work, hospitality, technology and other common industries.",
    }
    existing = pages.json()[0] if pages.json() else None
    endpoint = f"{SITE}/wp-json/wp/v2/pages/{existing['id']}" if existing else f"{SITE}/wp-json/wp/v2/pages"
    result = session.post(endpoint, headers={"X-WP-Nonce": nonce}, json=payload, timeout=90)
    result.raise_for_status()
    data = result.json()
    return {"id": data.get("id"), "status": data.get("status"), "link": data.get("link")}


def main():
    package()
    session = chrome_session()
    nonce = rest_nonce(session)
    upload(session)
    ensure_active(session, nonce)
    page = ensure_page(session, nonce)
    print(json.dumps({"plugin": PLUGIN_REF, "status": "active", "page": page}, indent=2))


if __name__ == "__main__":
    main()
