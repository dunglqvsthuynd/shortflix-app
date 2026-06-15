"""Convert phim-json/ scrape into compact bundled catalog JSON.

Usage:
    python scripts/build_catalog.py [SRC_DIR] [OUT_DIR]

Defaults: SRC_DIR = ../http-proxy-lab/phim-json, OUT_DIR = src/data

Enriches each movie with fields the original site exposes:
  - rating   : popularityScore (4.5-4.9) parsed from the per-movie *-movie.html
  - cast     : actor names/pics from actor_info (when present, ~63% of titles)
  - tags     : broader tag_list themes/tropes (beyond the genre subset)
  - episodes : isFree derived from paid_start (first N free, rest locked)
Note: read_count (views) is NOT present in these captures, so it is not emitted.
"""
import json
import os
import re
import sys
import glob

# tag_list category_id -> meaning. Keep only genre-like categories (in priority order);
# drop actors (1001/1005), audience/gender (1000), region (1013), age rating (1015),
# location (1023), plot-device (1024), and the noisy mood bucket (1012).
GENRE_CATEGORIES = ["1010", "1010001", "1011", "1020", "1022"]

# popularityScore embedded in the movie HTML's schema.org JSON.
RATING_RE = re.compile(r'"popularityScore":\{[^}]*?"value":([0-9.]+)')
# book_id (24 hex) sits right before -movie.html in the scraped filenames.
HTML_ID_RE = re.compile(r"-([0-9a-f]{24})-movie\.html$")


def _load(path):
    with open(path, encoding="utf-8-sig") as f:
        return json.load(f)


def _rating_map(html_dir):
    """book_id -> rating, by scanning the per-movie HTML for popularityScore."""
    out = {}
    for h in glob.glob(os.path.join(html_dir, "*-movie.html")):
        m = HTML_ID_RE.search(os.path.basename(h))
        if not m:
            continue
        try:
            with open(h, encoding="utf-8", errors="ignore") as f:
                txt = f.read()
        except OSError:
            continue
        rm = RATING_RE.search(txt)
        if rm:
            try:
                out[m.group(1)] = round(float(rm.group(1)), 1)
            except ValueError:
                pass
    return out


def _cast(data):
    """Up to 10 {name, pic} from actor_info; empty list when none."""
    info = data.get("actor_info") or {}
    cast = []
    for a in (info.get("actors") or []):
        name = (a.get("actor_name") or "").strip()
        if not name:
            continue
        cast.append({"name": name, "pic": a.get("actor_pic") or ""})
        if len(cast) >= 10:
            break
    return cast


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
    # Group tag texts by category.
    by_cat = {}
    for t in data.get("tag_list") or []:
        if not isinstance(t, dict):
            continue
        cid = str(t.get("category_id"))
        txt = t.get("text")
        if txt:
            by_cat.setdefault(cid, []).append(txt)
    # Genres: the curated genre categories, in priority order.
    genres = []
    for cid in GENRE_CATEGORIES:
        for txt in by_cat.get(cid, []):
            if txt not in genres:
                genres.append(txt)
    # Tags/themes: every other tag text (tropes, setting, mood...) not already a genre,
    # excluding pure actor-name categories (1001/1005) which are surfaced as cast.
    tags = []
    for cid, texts in by_cat.items():
        if cid in ("1001", "1005"):
            continue
        for txt in texts:
            if txt not in genres and txt not in tags:
                tags.append(txt)
    paid_start = data.get("paid_start")
    return {
        "id": data.get("book_id") or obj.get("book_id"),
        "title": (data.get("book_title") or obj.get("book_title") or "").strip(),
        "synopsis": (data.get("special_desc") or "").strip(),
        "poster": data.get("book_pic") or "",
        "genres": genres[:6],
        "tags": tags[:12],
        "cast": _cast(data),
        "collectCount": int(data.get("collect_count") or 0),
        "paidStart": int(paid_start) if paid_start else 0,
    }


def _episodes(summary_path, paid_start):
    rows = _load(summary_path)
    eps = []
    for r in rows:
        url = r.get("video_url")
        if not url:
            continue
        n = int(r.get("serial_number") or (len(eps) + 1))
        # Freemium: episodes before paid_start are free, the rest are locked.
        # paid_start == 0 (unknown) -> keep everything free.
        is_free = paid_start <= 0 or n < paid_start
        eps.append({
            "number": n,
            "chapterId": r.get("chapter_id") or "",
            "duration": int(r.get("duration") or 0),
            "thumbnail": r.get("video_pic") or "",
            "videoUrl": url,
            "isFree": is_free,
        })
    eps.sort(key=lambda e: e["number"])
    return eps


def build(src_dir, out_dir):
    os.makedirs(out_dir, exist_ok=True)
    html_dir = os.path.dirname(os.path.abspath(src_dir))  # HTML live beside phim-json/
    ratings = _rating_map(html_dir)
    print(f"Parsed {len(ratings)} ratings from HTML in {html_dir}")
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

    seen = set()
    for sp in glob.glob(os.path.join(src_dir, "*-episodes-summary.json")):
        try:
            rows = _load(sp)
        except Exception as e:  # noqa: BLE001
            print(f"skip summary {os.path.basename(sp)}: {e}")
            continue
        if not rows:
            continue
        book_id = rows[0].get("book_id")
        if not book_id or book_id in seen:
            continue  # dedupe: one entry per book_id
        meta = full_by_book.get(book_id)
        if not meta:
            # fall back to summary-only metadata
            meta = {
                "id": book_id,
                "title": (rows[0].get("book_title") or "").strip(),
                "synopsis": "",
                "poster": rows[0].get("video_pic") or "",
                "genres": [],
                "tags": [],
                "cast": [],
                "collectCount": 0,
                "paidStart": 0,
            }
        eps = _episodes(sp, meta.get("paidStart") or 0)
        if not eps:
            continue
        seen.add(book_id)
        rating = ratings.get(book_id)
        if rating:
            meta["rating"] = rating
        meta.pop("paidStart", None)  # internal-only; not shipped in movies.json
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
    with_rating = sum(1 for m in movies if m.get("rating"))
    with_cast = sum(1 for m in movies if m.get("cast"))
    locked = sum(1 for v in episodes_map.values() for e in v if not e["isFree"])
    print(f"Wrote {len(movies)} movies, {total_eps} episodes -> {out_dir}")
    print(f"  rating: {with_rating} | cast: {with_cast} | locked episodes: {locked}")
    return movies, episodes_map


if __name__ == "__main__":
    src = sys.argv[1] if len(sys.argv) > 1 else os.path.join("..", "http-proxy-lab", "phim-json")
    out = sys.argv[2] if len(sys.argv) > 2 else os.path.join("src", "data")
    build(src, out)
