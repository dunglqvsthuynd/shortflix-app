"""Scrape VI titles the main scraper misses because their /_next/data movie route
301-redirects to a canonical book (different slug+id). We follow `__N_REDIRECT` to the
real book, then reuse do_movie() against the canonical slug+id.

Run:  python scripts/scrape_vi_new.py [--out scripts/vi-new-extra.json]
"""
import argparse
import json
import re
import urllib.parse as up

import scrape_vi_dubbed as S

REDIR_RE = re.compile(r"-([0-9a-f]{24})$")


def resolve_redirect(build_id, slug, book_id):
    """If the movie route redirects, return (canonical_slug, canonical_id); else None."""
    try:
        raw = S.get(f"{S.BASE}/_next/data/{build_id}/vi/movie/{up.quote(slug)}-{book_id}.json")
        pp = (json.loads(raw).get("pageProps")) or {}
    except Exception:  # noqa: BLE001
        return None
    tgt = pp.get("__N_REDIRECT")
    if not tgt:
        return None
    path = up.unquote(tgt).rsplit("/", 1)[-1]  # {slug}-{id}
    m = REDIR_RE.search(path)
    if not m:
        return None
    cid = m.group(1)
    cslug = path[: m.start()]  # slug without the trailing -id
    return cslug, cid


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="scripts/vi-new-extra.json")
    args = ap.parse_args()

    build_id, books, slugs = S.crawl_catalog()
    have = {m["id"] for m in json.load(open("src/data/movies.json", encoding="utf-8"))}
    new = [(b, t) for b, t in books.items() if b not in have]
    print(f"buildId={build_id} | {len(new)} books not in app; following redirects...", flush=True)

    movies, eps_map, done = [], {}, set()
    for b, t in new:
        slug = slugs.get(b) or S.slugify(t)
        r = resolve_redirect(build_id, slug, b)
        if not r:
            continue  # no redirect / unresolved -> skip
        cslug, cid = r
        if cid in have or cid in done:
            continue  # alias of a title we already have / already scraped
        done.add(cid)
        res = S.do_movie(build_id, cid, t, cslug)
        n = len(res[1]) if res else 0
        print(f"  {t[:48]:48} -> {cid} : {n} eps", flush=True)
        if res:
            movies.append(res[0])
            eps_map[cid] = res[1]

    movies.sort(key=lambda m: m["collectCount"], reverse=True)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump({"movies": movies, "episodes": eps_map}, f, ensure_ascii=False)
    total = sum(len(v) for v in eps_map.values())
    print(f"Wrote {len(movies)} movies, {total} episodes -> {args.out}", flush=True)


if __name__ == "__main__":
    main()
