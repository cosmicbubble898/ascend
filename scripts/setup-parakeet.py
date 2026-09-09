"""Explicit setup only. Never imported or invoked by the transcription worker."""

import hashlib
import json
import shutil
import sys
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
from ascend_engine.transcription.assets import verify_bundle  # noqa: E402


class FixedOrigins(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        url = urllib.parse.urlsplit(newurl)
        if (
            url.scheme != "https"
            or not url.hostname
            or not (
                url.hostname == "huggingface.co"
                or url.hostname.endswith(".huggingface.co")
                or url.hostname.endswith(".hf.co")
            )
        ):
            raise ValueError("download_origin")
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def main():
    manifest_path = ROOT / "docs/proposals/parakeet-model-manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    target = ROOT / "runtime/parakeet-model"
    target.mkdir(exist_ok=True)
    staging_root = ROOT / "runtime/parakeet-staging"
    staging_root.mkdir(exist_ok=True)
    if shutil.disk_usage(ROOT).free < 12 * 1024**3:
        raise ValueError("setup_disk_space")
    opener = urllib.request.build_opener(FixedOrigins())
    for entry in manifest["files"]:
        name = entry["name"]
        if Path(name).name != name:
            raise ValueError("asset_name")
        final = target / name
        if final.is_file() and final.stat().st_size == entry["bytes"]:
            with final.open("rb") as source:
                if hashlib.file_digest(source, "sha256").hexdigest() == entry["sha256"]:
                    print("verified", name, flush=True)
                    continue
        staging = staging_root / (name + ".partial")
        url = (
            "https://huggingface.co/"
            + manifest["repository"]
            + "/resolve/"
            + manifest["revision"]
            + "/"
            + name
        )
        digest = hashlib.sha256()
        count = 0
        with opener.open(url, timeout=60) as response, staging.open("wb") as output:
            while chunk := response.read(4 * 1024**2):
                count += len(chunk)
                if count > entry["bytes"]:
                    raise ValueError("asset_size")
                digest.update(chunk)
                output.write(chunk)
        if count != entry["bytes"] or digest.hexdigest() != entry["sha256"]:
            raise ValueError("asset_integrity")
        # Move only between these exact, ignored model-setup directories.
        if (
            staging.resolve().parent != staging_root.resolve()
            or final.resolve().parent != target.resolve()
        ):
            raise ValueError("asset_path")
        staging.replace(final)
        print("verified", name, count, flush=True)
    verify_bundle(target, manifest_path)
    print("model_bundle_verified", flush=True)


if __name__ == "__main__":
    main()
