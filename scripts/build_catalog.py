"""Convert phim-json/ scrape into compact bundled catalog JSON.

Usage:
    python scripts/build_catalog.py [SRC_DIR] [OUT_DIR]

Defaults: SRC_DIR = ../http-proxy-lab/phim-json, OUT_DIR = src/data
"""
import json
import os
import sys
import glob

FREE_EPISODES = 3  # first N episodes free, mirrors web app (i < 3)


def _load(path):
    with open(path, encoding="utf-8-sig") as f:
        return json.load(f)


def _book_meta(full_path):
    """Extract book-level metadata from a *-full-responses.json file."""
    obj = _load(full_path)
    responses = obj.get("responses") or []
    data = {}
    for r in responses:
        d = (r.get("pageProps") or {}).get("data") or {}
        if d.get("book_id"):
            data = d
            break
    if not data:
        return None
    genres = []
    for t in data.get("tag_list") or []:
        txt = t.get("text") if isinstance(t, dict) else t
        if txt and txt not in genres:
            genres.append(txt)
    return {
        "id": data.get("book_id") or obj.get("book_id"),
        "title": (data.get("book_title") or obj.get("book_title") or "").strip(),
        "synopsis": (data.get("special_desc") or "").strip(),
        "poster": data.get("book_pic") or "",
        "genres": genres[:6],
        "collectCount": int(data.get("collect_count") or 0),
    }


def _episodes(summary_path):
    rows = _load(summary_path)
    eps = []
    for r in rows:
        url = r.get("video_url")
        if not url:
            continue
        n = int(r.get("serial_number") or (len(eps) + 1))
        eps.append({
            "number": n,
            "chapterId": r.get("chapter_id") or "",
            "duration": int(r.get("duration") or 0),
            "thumbnail": r.get("video_pic") or "",
            "videoUrl": url,
            "isFree": n <= FREE_EPISODES,
        })
    eps.sort(key=lambda e: e["number"])
    return eps


def build(src_dir, out_dir):
    os.makedirs(out_dir, exist_ok=True)
    movies, episodes_map = [], {}

    # Index full-responses by book_id to pair with episode summaries.
    full_by_book = {}
    for fp in glob.glob(os.path.join(src_dir, "*-full-responses.json")):
        try:
            meta = _book_meta(fp)
        except Exception as e:  # noqa: BLE001 - skip malformed files, keep going
            print(f"skip full {os.path.basename(fp)}: {e}")
            continue
        if meta and meta["id"]:
            full_by_book[meta["id"]] = meta

    for sp in glob.glob(os.path.join(src_dir, "*-episodes-summary.json")):
        try:
            rows = _load(sp)
        except Exception as e:  # noqa: BLE001
            print(f"skip summary {os.path.basename(sp)}: {e}")
            continue
        if not rows:
            continue
        book_id = rows[0].get("book_id")
        eps = _episodes(sp)
        if not book_id or not eps:
            continue
        meta = full_by_book.get(book_id)
        if not meta:
            # fall back to summary-only metadata
            meta = {
                "id": book_id,
                "title": (rows[0].get("book_title") or "").strip(),
                "synopsis": "",
                "poster": rows[0].get("video_pic") or "",
                "genres": [],
                "collectCount": 0,
            }
        meta["episodeCount"] = len(eps)
        meta["badge"] = (
            "HOT" if meta["collectCount"] > 20000
            else ("NEW" if meta["collectCount"] > 5000 else "")
        )
        movies.append(meta)
        episodes_map[book_id] = eps

    movies.sort(key=lambda m: m["collectCount"], reverse=True)

    with open(os.path.join(out_dir, "movies.json"), "w", encoding="utf-8") as f:
        json.dump(movies, f, ensure_ascii=False)
    with open(os.path.join(out_dir, "episodes.json"), "w", encoding="utf-8") as f:
        json.dump(episodes_map, f, ensure_ascii=False)

    total_eps = sum(len(v) for v in episodes_map.values())
    print(f"Wrote {len(movies)} movies, {total_eps} episodes -> {out_dir}")
    return movies, episodes_map


if __name__ == "__main__":
    src = sys.argv[1] if len(sys.argv) > 1 else os.path.join("..", "http-proxy-lab", "phim-json")
    out = sys.argv[2] if len(sys.argv) > 2 else os.path.join("src", "data")
    build(src, out)
