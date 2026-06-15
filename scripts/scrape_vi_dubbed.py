#!/usr/bin/env python3
"""Scrape Vietnamese-DUBBED ("[lồng tiếng]") short-dramas from reelshort.com/vi and emit
app-format movie + episode JSON. These play with Vietnamese AUDIO.

Pipeline (web _next/data, no auth; robots.txt allows /):
  /vi  +  /vi/shelf/*   ->  book objects (book_id, title)         [discover catalog]
  per movie: slug = slugify(title)
     /_next/data/{buildId}/vi/movie/{slug}-{book_id}.json         -> online_base (all
         chapters w/ serial_number) + metadata (poster, desc, tags, collect/read count)
     /_next/data/{buildId}/vi/episodes/episode-{n}-{slug}-{book_id}-{chapter_id}.json
                                                                  -> resolved video_url
  -> scripts/vi-dubbed.json  { movies:[...], episodes:{book_id:[...]} }

Run:  python scripts/scrape_vi_dubbed.py [--all] [--limit N] [--workers 6]
      (default: dubbed "[lồng tiếng]" titles only; --all = every VI title)
"""
import argparse
import concurrent.futures as cf
import json
import os
import re
import ssl
import threading
import time
import urllib.error
import urllib.parse as up
import urllib.request

BASE = "https://www.reelshort.com"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
_CTX = ssl._create_unverified_context()
_OPENER = urllib.request.build_opener(urllib.request.ProxyHandler({}), urllib.request.HTTPSHandler(context=_CTX))
_lock = threading.Lock()


def get(url, tries=3):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Referer": BASE + "/"})
    last = None
    for i in range(tries):
        try:
            return _OPENER.open(req, timeout=30).read().decode("utf-8", "ignore")
        except urllib.error.HTTPError as e:
            if e.code == 404:
                raise
            last = e
            time.sleep(0.5 * (i + 1))
        except Exception as e:  # noqa: BLE001
            last = e
            time.sleep(0.5 * (i + 1))
    raise last


def next_data(html):
    return json.loads(re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', html, re.S).group(1))


def slugify(title):
    out = []
    for ch in title.lower().strip():
        out.append(ch if ch.isalnum() else " ")
    return "-".join("".join(out).split())


def crawl_catalog():
    """Collect books + exact URL slugs across the /vi homepage + all genre shelves.
    Returns (build_id, {book_id: title}, {book_id: exact_slug_from_anchor})."""
    home = get(BASE + "/vi")
    build_id = re.search(r'"buildId":"(\d+)"', home).group(1)
    pages = [home]
    for sh in sorted(set(re.findall(r"/vi/shelf/([^\"?]+)", home))):
        try:
            pages.append(get(BASE + "/vi/shelf/" + sh))
        except Exception:  # noqa: BLE001
            pass
    books, slugs = {}, {}

    def walk(o):
        if isinstance(o, dict):
            if o.get("book_id") and o.get("book_title"):
                books.setdefault(o["book_id"], o["book_title"].strip())
            for v in o.values():
                walk(v)
        elif isinstance(o, list):
            for v in o:
                walk(v)

    for html in pages:
        try:
            walk(next_data(html))
        except Exception:  # noqa: BLE001
            pass
        # exact slug from episode anchors: episode-1-{slug}-{bookid}-{chapter}
        for m in re.finditer(r"episode-1-(.+?)-([0-9a-f]{24})-[a-z0-9]+", html):
            slugs.setdefault(m.group(2), up.unquote(m.group(1)))
    return build_id, books, slugs


def movie_detail(build_id, slug, book_id):
    url = f"{BASE}/_next/data/{build_id}/vi/movie/{up.quote(slug)}-{book_id}.json"
    d = (json.loads(get(url)).get("pageProps") or {}).get("data") or {}
    return d


def scrape_episode(build_id, slug, book_id, serial, chapter_id):
    route = f"episode-{serial}-{slug}-{book_id}-{chapter_id}"
    url = f"{BASE}/_next/data/{build_id}/vi/episodes/{up.quote(route)}.json"
    d = (json.loads(get(url)).get("pageProps") or {}).get("data") or {}
    vu = d.get("video_url") or ""
    if not vu:
        return None
    return {
        "number": int(d.get("serial_number") or serial),
        "chapterId": chapter_id,
        "duration": int(d.get("duration") or 0),
        "thumbnail": d.get("video_pic") or "",
        "videoUrl": vu,
    }


def _chapters_for(build_id, slug, book_id):
    try:
        d = movie_detail(build_id, slug, book_id)
    except urllib.error.HTTPError:
        return None, []
    except Exception:  # noqa: BLE001
        return None, []
    chapters = d.get("online_base") or d.get("chapter_base") or []
    # Real episodes only: drop the trailer (chapter_type 2 / serial 0).
    chapters = [c for c in chapters if c.get("chapter_type") != 2 and (c.get("serial_number") or 0) >= 1]
    return d, chapters


def do_movie(build_id, book_id, title, exact_slug=None):
    # Try the exact anchor slug first, then a slugified-title fallback.
    candidates = []
    if exact_slug:
        candidates.append(exact_slug)
    s = slugify(title)
    if s not in candidates:
        candidates.append(s)
    d, chapters, slug = None, [], None
    for cand in candidates:
        d, chapters = _chapters_for(build_id, cand, book_id)
        if chapters:
            slug = cand
            break
    if not chapters:
        return None
    eps = [None] * len(chapters)

    def one(i):
        c = chapters[i]
        try:
            eps[i] = scrape_episode(build_id, slug, book_id, int(c["serial_number"]), c["chapter_id"])
        except Exception:  # noqa: BLE001
            eps[i] = None

    with cf.ThreadPoolExecutor(max_workers=4) as ex:
        list(ex.map(one, range(len(chapters))))
    eps = [e for e in eps if e]
    if not eps:
        return None
    eps.sort(key=lambda e: e["number"])
    for e in eps:
        e["isFree"] = True  # VI-dubbed catalog ships without a reliable paywall marker
    collect = int(d.get("collect_count") or 0)
    movie = {
        "id": book_id,
        "title": title,
        "synopsis": (d.get("special_desc") or "").strip(),
        "poster": d.get("book_pic") or "",
        "genres": [t.get("text") for t in (d.get("tag_list") or []) if isinstance(t, dict) and t.get("text")][:6],
        "tags": [],
        "cast": [],
        "collectCount": collect,
        "episodeCount": len(eps),
        "badge": "",
        "dubbed": "lồng tiếng" in title.lower(),  # VI audio; others are VI-subtitled
        "viNative": True,
    }
    return movie, eps


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--all", action="store_true", help="scrape every VI title, not just dubbed")
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--workers", type=int, default=6)
    ap.add_argument("--out", default=os.path.join("scripts", "vi-dubbed.json"))
    args = ap.parse_args()

    build_id, books, slugs = crawl_catalog()
    items = [(b, t) for b, t in books.items() if args.all or "lồng tiếng" in t.lower()]
    if args.limit:
        items = items[: args.limit]
    print(f"buildId={build_id} | catalog books: {len(books)} | anchors: {len(slugs)} | "
          f"scraping {len(items)} ({'all' if args.all else 'dubbed only'})", flush=True)

    movies, episodes_map = [], {}
    pending = list(items)
    # Retry rounds: re-attempt anything that yielded nothing, until a round adds nothing new.
    rounds = 0
    while pending:
        rounds += 1
        failed, done = [], [0]
        with cf.ThreadPoolExecutor(max_workers=args.workers) as ex:
            futs = {ex.submit(do_movie, build_id, b, t, slugs.get(b)): (b, t) for b, t in pending}
            for fut in cf.as_completed(futs):
                b, t = futs[fut]
                try:
                    r = fut.result()
                except Exception:  # noqa: BLE001
                    r = None
                with _lock:
                    done[0] += 1
                    if r:
                        movies.append(r[0])
                        episodes_map[b] = r[1]
                    else:
                        failed.append((b, t))
                    print(f"  r{rounds} [{done[0]}/{len(pending)}] {b} -> {len(r[1]) if r else 0} eps", flush=True)
        got = len(pending) - len(failed)
        print(f"== round {rounds}: +{got} ok, {len(failed)} failed ==", flush=True)
        if got == 0 or rounds >= 8:  # stop when a full round adds nothing, or after 8 rounds
            break
        pending = failed

    movies.sort(key=lambda m: m["collectCount"], reverse=True)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump({"movies": movies, "episodes": episodes_map}, f, ensure_ascii=False)
    total = sum(len(v) for v in episodes_map.values())
    print(f"Wrote {len(movies)} movies, {total} episodes -> {args.out}", flush=True)


if __name__ == "__main__":
    main()
