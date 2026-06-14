import json
import os
import importlib.util
import pathlib

SPEC = pathlib.Path(__file__).parent / "build_catalog.py"
spec = importlib.util.spec_from_file_location("build_catalog", SPEC)
bc = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bc)


def _write(d, name, obj):
    with open(os.path.join(d, name), "w", encoding="utf-8-sig") as f:
        json.dump(obj, f)


def test_build_produces_movie_and_episodes(tmp_path):
    src = tmp_path / "phim-json"; src.mkdir()
    out = tmp_path / "out"; out.mkdir()
    _write(str(src), "demo-episodes-summary.json", [
        {"serial_number": 1, "book_title": "Demo", "book_id": "B1",
         "chapter_id": "c1", "chapter_count": 2, "duration": 60,
         "video_pic": "pic1.jpg", "video_url": "u1.m3u8"},
        {"serial_number": 2, "book_title": "Demo", "book_id": "B1",
         "chapter_id": "c2", "chapter_count": 2, "duration": 70,
         "video_pic": "pic2.jpg", "video_url": "u2.m3u8"},
    ])
    _write(str(src), "demo-full-responses.json", {
        "book_title": "Demo", "book_id": "B1",
        "responses": [{"pageProps": {"data": {
            "book_id": "B1", "book_title": "Demo",
            "special_desc": "A synopsis.",
            "book_pic": "poster.jpg", "collect_count": 100,
            "tag_list": [
                {"text": "Drama", "category_id": "1010"},
                {"text": "Revenge", "category_id": "1010001"},
                {"text": "Jesse Morales", "category_id": "1001"},  # actor -> dropped
                {"text": "Female", "category_id": "1000"},        # gender -> dropped
                {"text": "China", "category_id": "1013"},         # region -> dropped
            ],
        }}}],
    })

    bc.build(str(src), str(out))

    movies = json.load(open(out / "movies.json", encoding="utf-8"))
    episodes = json.load(open(out / "episodes.json", encoding="utf-8"))

    assert len(movies) == 1
    m = movies[0]
    assert m["id"] == "B1"
    assert m["title"] == "Demo"
    assert m["synopsis"] == "A synopsis."
    assert m["poster"] == "poster.jpg"
    assert m["genres"] == ["Drama", "Revenge"]
    assert m["episodeCount"] == 2

    eps = episodes["B1"]
    assert len(eps) == 2
    assert eps[0]["number"] == 1
    assert eps[0]["videoUrl"] == "u1.m3u8"
    assert eps[0]["isFree"] is True
    assert eps[1]["isFree"] is True


def test_movie_without_episodes_is_skipped(tmp_path):
    src = tmp_path / "phim-json"; src.mkdir()
    out = tmp_path / "out"; out.mkdir()
    _write(str(src), "x-full-responses.json", {
        "book_id": "B2", "book_title": "NoEps",
        "responses": [{"pageProps": {"data": {
            "book_id": "B2", "book_title": "NoEps", "special_desc": "",
            "book_pic": "p.jpg", "collect_count": 0, "tag_list": []}}}]})
    bc.build(str(src), str(out))
    movies = json.load(open(out / "movies.json", encoding="utf-8"))
    assert movies == []


def test_all_episodes_free_when_unlimited(tmp_path):
    src = tmp_path / "phim-json"; src.mkdir()
    out = tmp_path / "out"; out.mkdir()
    rows = [{"serial_number": i, "book_title": "T", "book_id": "B3",
             "chapter_id": f"c{i}", "duration": 30, "video_pic": "p.jpg",
             "video_url": f"u{i}.m3u8"} for i in range(1, 6)]
    _write(str(src), "t-episodes-summary.json", rows)
    bc.build(str(src), str(out))
    eps = json.load(open(out / "episodes.json", encoding="utf-8"))["B3"]
    assert all(e["isFree"] for e in eps)  # FREE_EPISODES is None -> nothing locked
