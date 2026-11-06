#!/usr/bin/env python3
"""Generates the extended exercise library from free-exercise-db (public domain, Unlicense:
https://github.com/yuhonas/free-exercise-db).

Writes:
  src/data/library.ts           small index, part of the main bundle
  src/data/library-details.ts   steps and tips, a separate chunk loaded on demand
  public/exercises/library/     start/end photos, fetched when viewed (not precached)

Curated exercises (scripts/fetch_exercise_images.py) are skipped. Library exercises never enter
generated plans. Re-run only to refresh the library:  python3 scripts/generate_library.py
"""
import importlib.util
import io
import json
import pathlib
import re
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor

from PIL import Image

sys.dont_write_bytecode = True  # importing the photo script must not leave a __pycache__
ROOT = pathlib.Path(__file__).resolve().parent.parent
SOURCE = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main"
OUT = ROOT / "public" / "exercises" / "library"
SIZE = (480, 320)

EQUIPMENT = {
    "barbell": "barbell", "e-z curl bar": "barbell", "dumbbell": "dumbbell", "cable": "cable", "machine": "machine",
    "body only": "bodyweight", None: "bodyweight", "kettlebells": "kettlebell", "bands": "band",
}
MUSCLES = {
    "quadriceps": "legs", "hamstrings": "legs", "adductors": "legs", "abductors": "glutes", "glutes": "glutes",
    "calves": "calves", "abdominals": "core", "lats": "back", "middle back": "back", "lower back": "back",
    "traps": "shoulders", "neck": "shoulders", "shoulders": "shoulders", "chest": "chest", "triceps": "triceps",
    "biceps": "biceps", "forearms": "biceps",
}
# Stretches and cardio machines need timed tracking, which the app does not have yet.
SKIP_CATEGORIES = {"stretching", "cardio"}
LEVELS = {"beginner": "beginner", "intermediate": "intermediate", "expert": "advanced"}
PROPS = {"barbell": "barbell", "dumbbell": "dumbbell", "kettlebell": "kettlebell", "cable": "handle", "machine": "handle", "band": "handle"}
# Stick-figure fallback, used only while a photo cannot load. First match wins.
MOTION_WORDS = [
    (r"pulldown", "pulldown"), (r"pull-?up|chin", "pullup"), (r"push-?up", "pushup"), (r"lunge|step", "lunge"),
    (r"deadlift|good morning|clean|snatch", "hinge"), (r"squat", "squat"), (r"\brow\b|rows\b", "row"), (r"\bdips?\b", "dip"),
    (r"plank|bridge", "plank"), (r"fly|flye|crossover", "fly"), (r"lateral|side raise", "lateral-raise"), (r"shrug", "shrug"),
    (r"leg press", "leg-press"), (r"leg curl|leg extension", "leg-extension"), (r"jump|hop|bound", "jump"),
]
MOTION_BY_GROUP = {
    "chest": "bench-press", "back": "row", "shoulders": "overhead-press", "biceps": "curl", "triceps": "pushdown",
    "legs": "squat", "glutes": "bridge", "calves": "calf-raise", "core": "crunch",
}
BOILERPLATE = re.compile(r"(this will be your starting position|repeat .*(recommended|desired|prescribed)|recommended amount of|for the recommended)", re.I)
ASIDE = re.compile(r"^(caution|tip|note|variations?|warning|hint)\s*:\s*", re.I)


def sentences(text: str) -> list[str]:
    return [s.strip() for s in re.split(r"(?<=[.!?])\s+(?=[A-Z])", text.strip()) if s.strip()]


def clean(instructions: list[str]) -> tuple[list[str], str | None]:
    """Drops boilerplate and pulls asides out of the steps; returns (steps, first aside)."""
    steps, tip = [], None
    for line in instructions:
        kept = []
        for sentence in sentences(line):
            if ASIDE.match(sentence):
                tip = tip or ASIDE.sub("", sentence)
            elif not BOILERPLATE.search(sentence):
                kept.append(sentence)
        if kept:
            steps.append(" ".join(kept))
    if len(steps) < 2:
        steps = [s for line in steps for s in sentences(line)]
    return steps, tip


def default_tip(x: dict, equipment: str) -> str:
    if x["category"] == "olympic weightlifting":
        return "A technical lift: learn it with an empty bar, ideally with a coach."
    if x["category"] == "plyometrics":
        return "Land softly with bent knees, and rest as soon as your landings get heavy."
    if equipment == "bodyweight":
        return "Slow, controlled reps beat fast ones."
    if x["mechanic"] == "compound":
        return "Start light and add weight only when every rep looks the same."
    return "Use a weight you can control, and lower it slowly."


def motion(name: str, group: str) -> str:
    for pattern, value in MOTION_WORDS:
        if re.search(pattern, name, re.I):
            return value
    return MOTION_BY_GROUP[group]


def convert(job: tuple[str, str, int]) -> None:
    ours, theirs, frame = job
    dest = OUT / f"{ours}-{frame}.webp"
    if dest.exists():
        return
    with urllib.request.urlopen(f"{SOURCE}/exercises/{theirs}/{frame}.jpg", timeout=60) as res:
        img = Image.open(io.BytesIO(res.read())).convert("RGB")
    # Fit inside 3:2 with dark bars, so the app's crop never cuts off a head or feet.
    img.thumbnail(SIZE, Image.LANCZOS)
    canvas = Image.new("RGB", SIZE, (17, 17, 17))
    canvas.paste(img, ((SIZE[0] - img.width) // 2, (SIZE[1] - img.height) // 2))
    canvas.save(dest, "WEBP", quality=68, method=6)


def curated() -> tuple[set[str], set[str], set[str]]:
    spec = importlib.util.spec_from_file_location("fetch_images", ROOT / "scripts" / "fetch_exercise_images.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    text = (ROOT / "src" / "data" / "exercises.ts").read_text()
    return set(module.MAPPING.values()), set(re.findall(r"e\(\{ id: '([^']+)'", text)), {n.lower() for n in re.findall(r"e\(\{ id: '[^']+', name: '([^']+)'", text)}


def main() -> None:
    with urllib.request.urlopen(f"{SOURCE}/dist/exercises.json", timeout=60) as res:
        catalogue = json.load(res)
    used, curated_ids, curated_names = curated()
    rows, details, jobs, skipped = [], {}, [], []
    for x in sorted(catalogue, key=lambda e: e["name"].lower()):
        if x["id"] in used or x["category"] in SKIP_CATEGORIES or x["equipment"] not in EQUIPMENT:
            continue
        ours = re.sub(r"[^a-z0-9]+", "-", x["id"].lower()).strip("-")
        steps, tip = clean(x["instructions"])
        group = MUSCLES.get(x["primaryMuscles"][0])
        if not group or len(steps) < 2 or len(x["images"]) < 2 or ours in curated_ids or ours in details or x["name"].lower() in curated_names:
            skipped.append(x["id"])
            continue
        equipment = EQUIPMENT[x["equipment"]]
        secondary = list(dict.fromkeys(MUSCLES[m] for m in x["secondaryMuscles"] if m in MUSCLES and MUSCLES[m] != group))
        rows.append([ours, x["name"], group, secondary, [equipment], LEVELS[x["level"]], x["mechanic"] == "compound", motion(x["name"], group), PROPS.get(equipment, "none")])
        details[ours] = {"steps": steps, "tip": tip or default_tip(x, equipment)}
        jobs += [(ours, x["id"], frame) for frame in (0, 1)]

    OUT.mkdir(parents=True, exist_ok=True)
    with ThreadPoolExecutor(8) as pool:
        list(pool.map(convert, jobs))

    dump = lambda value: json.dumps(value, ensure_ascii=False)
    index = "\n".join(f"  {dump(row)}," for row in rows)
    (ROOT / "src" / "data" / "library.ts").write_text(
        "// Generated by scripts/generate_library.py. Do not edit by hand.\n"
        "import type { Equipment, Experience, MuscleGroup } from '../core/types';\n"
        "import type { MotionId } from './motions';\n"
        "import type { Prop } from './exercises';\n\n"
        "export type LibraryRow = [id: string, name: string, primary: MuscleGroup, secondary: MuscleGroup[], equipment: Equipment[], level: Experience, compound: boolean, motion: MotionId, prop: Prop];\n\n"
        f"export const LIBRARY_ROWS: readonly LibraryRow[] = [\n{index}\n];\n"
    )
    body = "\n".join(f"  {dump(k)}: {dump(v)}," for k, v in details.items())
    (ROOT / "src" / "data" / "library-details.ts").write_text(
        "// Generated by scripts/generate_library.py. Do not edit by hand.\n"
        f"export const LIBRARY_DETAILS: Readonly<Record<string, {{ steps: string[]; tip: string }}>> = {{\n{body}\n}};\n"
    )
    print(f"{len(rows)} exercises, {len(skipped)} skipped: {skipped}")


if __name__ == "__main__":
    main()
