"""Merge the richer Vietnamese feed (Downloads/phim-json-vi/movies-data.jsonl)
into the bundled catalog.

Unlike the older merge_vi_dub.py (which only added bare-bones rows), this feed
carries poster (book_pic), synopsis (description), Vietnamese tags and cast, so we:

  1. ADD genuinely-new titles (unseen book_id AND unseen normalized title) with the
     full rich mapping.
  2. ENRICH existing rows matched by book_id: backfill empty synopsis/tags/cast and
     upgrade a snapshot/empty poster to the real cover, then append any episodes the
     feed has that the app is missing (matched by serial number). Non-empty curated
     fields and existing episodes are never overwritten.

Title-only duplicates (same title, different book_id) are skipped to avoid creating
confusing near-duplicate rows.

Run: python scripts/merge_vi_data.py
"""
import json
import os
import sys

SRC = os.environ.get(
    "VI_JSONL", "C:/Users/tinsi/Downloads/phim-json-vi/movies-data.jsonl"
)
MOVIES_PATH = "src/data/movies.json"
EPISODES_PATH = "src/data/episodes.json"


def norm_title(t):
    return (t or "").lower().replace("[lồng tiếng]", "").strip()


def load_jsonl(path):
    out = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                out.append(json.loads(line))
    return out


def map_episodes(raw_eps):
    eps = [
        {
            "number": e.get("serial_number"),
            # The VI feed carries no per-episode chapter id; the app keys playback
            # off videoUrl, so an empty chapterId is fine.
            "chapterId": "",
            "duration": e.get("duration") or 0,
            "thumbnail": e.get("video_pic") or "",
            "videoUrl": e.get("video_url") or "",
            "isFree": True,
        }
        for e in raw_eps
        if e.get("video_url")
    ]
    eps.sort(key=lambda x: (x["number"] is None, x["number"]))
    return eps


def map_cast(rec):
    actors = (rec.get("actor_info") or {}).get("actors") or []
    return [
        {"name": a.get("actor_name") or "", "pic": a.get("actor_pic") or ""}
        for a in actors
        if a.get("actor_name")
    ]


def main():
    movies = json.load(open(MOVIES_PATH, encoding="utf-8"))
    episodes = json.load(open(EPISODES_PATH, encoding="utf-8"))

    by_id = {m["id"]: m for m in movies}
    seen_ids = set(by_id)
    seen_titles = {norm_title(m["title"]) for m in movies}

    recs = load_jsonl(SRC)

    added = []
    enriched_meta = 0
    enriched_eps = 0
    skipped_title_dup = 0
    skipped_empty = 0

    for r in recs:
        bid = r.get("book_id")
        title = r.get("book_title") or ""
        if not bid or not title:
            continue

        raw_eps = r.get("episodes") or []
        eps = map_episodes(raw_eps)

        # --- existing row: enrich in place -------------------------------
        if bid in seen_ids:
            mv = by_id[bid]
            desc = r.get("description")
            tags = r.get("tags")
            cast = map_cast(r)
            book_pic = r.get("book_pic")

            changed = False
            if desc and not mv.get("synopsis"):
                mv["synopsis"] = desc
                changed = True
            if tags and not mv.get("tags"):
                mv["tags"] = tags
                changed = True
            if cast and not mv.get("cast"):
                mv["cast"] = cast
                changed = True
            cur_poster = mv.get("poster") or ""
            if book_pic and (not cur_poster or "Snapshots" in cur_poster):
                mv["poster"] = book_pic
                changed = True
            if changed:
                enriched_meta += 1

            # Append episodes the app is missing (match by serial number).
            cur = episodes.get(bid, [])
            have = {e.get("number") for e in cur}
            extra = [e for e in eps if e["number"] not in have]
            if extra:
                cur.extend(extra)
                cur.sort(key=lambda x: (x.get("number") is None, x.get("number")))
                episodes[bid] = cur
                enriched_eps += 1
            continue

        # --- title-only duplicate: skip ----------------------------------
        if norm_title(title) in seen_titles:
            skipped_title_dup += 1
            continue

        # --- genuinely new title -----------------------------------------
        if not eps:
            skipped_empty += 1
            continue

        movie = {
            "id": bid,
            "title": title,
            "synopsis": r.get("description") or "",
            "poster": r.get("book_pic") or (raw_eps[0].get("video_pic") if raw_eps else "") or "",
            "genres": [],
            "tags": r.get("tags") or [],
            "cast": map_cast(r),
            "collectCount": r.get("collect_count") or 0,
            "episodeCount": r.get("episode_count") or len(eps),
            "badge": "",
            "dubbed": bool(r.get("has_dub")),
            "viNative": True,
        }

        cc = movie["collectCount"]
        pos = next(
            (i for i, m in enumerate(movies) if m.get("collectCount", 0) < cc),
            len(movies),
        )
        movies.insert(pos, movie)
        episodes[bid] = eps

        seen_ids.add(bid)
        seen_titles.add(norm_title(title))
        by_id[bid] = movie
        added.append((bid, title, len(eps), movie["dubbed"]))

    with open(MOVIES_PATH, "w", encoding="utf-8") as f:
        json.dump(movies, f, ensure_ascii=False, separators=(",", ":"))
    with open(EPISODES_PATH, "w", encoding="utf-8") as f:
        json.dump(episodes, f, ensure_ascii=False)

    print(f"records read         : {len(recs)}")
    print(f"skipped title-dup    : {skipped_title_dup}")
    print(f"skipped no-episode   : {skipped_empty}")
    print(f"enriched meta (dup)  : {enriched_meta}")
    print(f"enriched episodes    : {enriched_eps}")
    print(f"ADDED new titles     : {len(added)}")
    print(f"movies total now     : {len(movies)}")


if __name__ == "__main__":
    sys.exit(main())
