"""Merge a freshly-scraped Vietnamese catalog into the bundled movies/episodes JSON.

Additive UPSERT: each freshly-scraped VI movie (with episodes) is added if new or
refreshed if it already exists. VI titles already in the catalog that weren't in this
scrape are KEPT (a partial re-scrape must never drop working titles). The English
catalog is untouched. Re-sorts by collectCount (the app relies on movies.json being
sorted desc) and backs up the originals first.

Usage:
    python scripts/merge_vi.py [VI_JSON] [DATA_DIR]
Defaults: VI_JSON = scripts/vi-all-new.json, DATA_DIR = src/data
"""
import json
import os
import shutil
import sys


def _load(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def _dump(path, obj):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False)


def main():
    vi_json = sys.argv[1] if len(sys.argv) > 1 else os.path.join("scripts", "vi-all-new.json")
    data_dir = sys.argv[2] if len(sys.argv) > 2 else os.path.join("src", "data")
    movies_path = os.path.join(data_dir, "movies.json")
    eps_path = os.path.join(data_dir, "episodes.json")

    movies = _load(movies_path)
    episodes = _load(eps_path)
    vi = _load(vi_json)
    vi_movies = vi["movies"]
    vi_eps = vi["episodes"]

    # Backup originals before overwriting.
    shutil.copy2(movies_path, movies_path + ".bak")
    shutil.copy2(eps_path, eps_path + ".bak")

    by_id = {m["id"]: m for m in movies}
    before_vi = sum(1 for m in movies if m.get("viNative"))

    added, updated = 0, 0
    for m in vi_movies:
        bid = m["id"]
        eps = vi_eps.get(bid)
        if not eps:  # only upsert titles we actually have playable episodes for
            continue
        if bid in by_id:
            updated += 1
        else:
            added += 1
        by_id[bid] = m
        episodes[bid] = eps

    out_movies = list(by_id.values())
    # Drop any movie that ended up without episodes (safety; shouldn't happen).
    out_movies = [m for m in out_movies if episodes.get(m["id"])]
    out_movies.sort(key=lambda m: m.get("collectCount", 0), reverse=True)
    out_eps = {m["id"]: episodes[m["id"]] for m in out_movies}

    _dump(movies_path, out_movies)
    _dump(eps_path, out_eps)

    after_vi = sum(1 for m in out_movies if m.get("viNative"))
    total_eps = sum(len(v) for v in out_eps.values())
    print(f"fresh VI scrape: {len(vi_movies)} movies "
          f"({sum(1 for m in vi_movies if vi_eps.get(m['id']))} with episodes)")
    print(f"upsert: +{added} new, {updated} refreshed")
    print(f"VI titles: {before_vi} -> {after_vi}")
    print(f"wrote {len(out_movies)} movies, {total_eps} episodes -> {data_dir}")
    print(f"  dubbed: {sum(1 for m in out_movies if m.get('dubbed'))}")
    print(f"  backups: {movies_path}.bak, {eps_path}.bak")


if __name__ == "__main__":
    main()
