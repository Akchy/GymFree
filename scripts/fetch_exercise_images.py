#!/usr/bin/env python3
"""Downloads exercise photos from free-exercise-db (public domain, Unlicense:
https://github.com/yuhonas/free-exercise-db) and converts them to small WebP files in
public/exercises/<our-id>-0.webp (start) and -1.webp (end).

Images are committed to the repo so the app never calls a third party at runtime and
works offline. Re-run only when the mapping below changes:  python3 scripts/fetch_exercise_images.py
"""
import io
import pathlib
import urllib.request

from PIL import Image

BASE = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises"
OUT = pathlib.Path(__file__).resolve().parent.parent / "public" / "exercises"
WIDTH = 480

# our exercise id -> free-exercise-db id
MAPPING = {
    "push-up": "Pushups",
    "incline-push-up": "Incline_Push-Up",
    "bench-press": "Barbell_Bench_Press_-_Medium_Grip",
    "dumbbell-bench-press": "Dumbbell_Bench_Press",
    "machine-chest-press": "Machine_Bench_Press",
    "cable-fly": "Cable_Crossover",
    "pull-up": "Pullups",
    "chin-up": "Chin-Up",
    "lat-pulldown": "Wide-Grip_Lat_Pulldown",
    "barbell-row": "Bent_Over_Barbell_Row",
    "dumbbell-row": "One-Arm_Dumbbell_Row",
    "seated-cable-row": "Seated_Cable_Rows",
    "deadlift": "Barbell_Deadlift",
    "overhead-press": "Standing_Military_Press",
    "dumbbell-shoulder-press": "Dumbbell_Shoulder_Press",
    "lateral-raise": "Side_Lateral_Raise",
    "front-raise": "Front_Dumbbell_Raise",
    "shrug": "Dumbbell_Shrug",
    "dumbbell-curl": "Dumbbell_Bicep_Curl",
    "barbell-curl": "Barbell_Curl",
    "hammer-curl": "Hammer_Curls",
    "band-curl": "Standing_Biceps_Cable_Curl",
    "bench-dip": "Bench_Dips",
    "parallel-dip": "Dips_-_Triceps_Version",
    "overhead-triceps-extension": "Standing_Dumbbell_Triceps_Extension",
    "triceps-pushdown": "Triceps_Pushdown",
    "diamond-push-up": "Push-Ups_-_Close_Triceps_Position",
    "bodyweight-squat": "Bodyweight_Squat",
    "goblet-squat": "Goblet_Squat",
    "barbell-squat": "Barbell_Full_Squat",
    "lunge": "Bodyweight_Walking_Lunge",
    "bulgarian-split-squat": "Split_Squat_with_Dumbbells",
    "leg-press": "Leg_Press",
    "leg-extension": "Leg_Extensions",
    "leg-curl": "Seated_Leg_Curl",
    "romanian-deadlift": "Romanian_Deadlift",
    "glute-bridge": "Butt_Lift_Bridge",
    "hip-thrust": "Barbell_Hip_Thrust",
    "kettlebell-swing": "One-Arm_Kettlebell_Swings",
    "calf-raise": "Standing_Calf_Raises",
    "plank": "Plank",
    "crunch": "Crunches",
    "lying-leg-raise": "Flat_Bench_Lying_Leg_Raise",
    "mountain-climber": "Mountain_Climbers",
    "jumping-jack": "Star_Jump",
    "high-knees": "Jogging_Treadmill",
    "jump-rope": "Rope_Jumping",
    "incline-dumbbell-press": "Incline_Dumbbell_Press",
    "incline-bench-press": "Barbell_Incline_Bench_Press_-_Medium_Grip",
    "decline-bench-press": "Decline_Barbell_Bench_Press",
    "dumbbell-fly": "Dumbbell_Flyes",
    "pec-deck": "Butterfly",
    "wide-push-up": "Push-Up_Wide",
    "decline-push-up": "Push-Ups_With_Feet_Elevated",
    "inverted-row": "Inverted_Row",
    "back-extension": "Hyperextensions_Back_Extensions",
    "superman": "Superman",
    "two-dumbbell-row": "Bent_Over_Two-Dumbbell_Row",
    "t-bar-row": "Bent_Over_Two-Arm_Long_Bar_Row",
    "machine-row": "Leverage_Iso_Row",
    "close-grip-pulldown": "Close-Grip_Front_Lat_Pulldown",
    "straight-arm-pulldown": "Straight-Arm_Pulldown",
    "arnold-press": "Arnold_Dumbbell_Press",
    "face-pull": "Face_Pull",
    "reverse-fly": "Reverse_Flyes",
    "upright-row": "Upright_Barbell_Row",
    "machine-shoulder-press": "Machine_Shoulder_Military_Press",
    "band-pull-apart": "Band_Pull_Apart",
    "incline-dumbbell-curl": "Incline_Dumbbell_Curl",
    "concentration-curl": "Concentration_Curls",
    "preacher-curl": "Preacher_Curl",
    "reverse-curl": "Reverse_Barbell_Curl",
    "cable-hammer-curl": "Cable_Hammer_Curls_-_Rope_Attachment",
    "close-grip-bench-press": "Close-Grip_Barbell_Bench_Press",
    "skull-crusher": "EZ-Bar_Skullcrusher",
    "triceps-kickback": "Tricep_Dumbbell_Kickback",
    "rope-overhead-extension": "Cable_Rope_Overhead_Triceps_Extension",
    "machine-dip": "Dip_Machine",
    "front-squat": "Front_Squat_Clean_Grip",
    "smith-machine-squat": "Smith_Machine_Squat",
    "dumbbell-lunge": "Dumbbell_Lunges",
    "step-up": "Dumbbell_Step_Ups",
    "lying-leg-curl": "Lying_Leg_Curls",
    "sumo-squat": "Plie_Dumbbell_Squat",
    "good-morning": "Good_Morning",
    "single-leg-glute-bridge": "Single_Leg_Glute_Bridge",
    "glute-kickback": "Glute_Kickback",
    "cable-pull-through": "Pull_Through",
    "hip-abduction": "Thigh_Abductor",
    "seated-calf-raise": "Seated_Calf_Raise",
    "barbell-calf-raise": "Standing_Barbell_Calf_Raise",
    "leg-press-calf-raise": "Calf_Press_On_The_Leg_Press_Machine",
    "sit-up": "Sit-Up",
    "reverse-crunch": "Reverse_Crunch",
    "bicycle-crunch": "Air_Bike",
    "russian-twist": "Russian_Twist",
    "dead-bug": "Dead_Bug",
    "side-plank": "Side_Bridge",
    "cable-crunch": "Cable_Crunch",
    "pallof-press": "Pallof_Press_With_Rotation",
    "side-bend": "Dumbbell_Side_Bend",
    "rocket-jump": "Rocket_Jump",
    "tuck-jump": "Knee_Tuck_Jump",
    "split-jump": "Split_Jump",
    "skipping": "Fast_Skipping",
}

# Source photos stored end-first; swapped so -0 is always the start of the rep.
SWAP_FRAMES = {"upright-row", "smith-machine-squat", "side-bend"}


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for ours, theirs in MAPPING.items():
        for frame in (0, 1):
            dest = OUT / f"{ours}-{frame}.webp"
            if dest.exists():
                continue
            source = 1 - frame if ours in SWAP_FRAMES else frame
            with urllib.request.urlopen(f"{BASE}/{theirs}/{source}.jpg", timeout=30) as res:
                img = Image.open(io.BytesIO(res.read())).convert("RGB")
            img = img.resize((WIDTH, round(img.height * WIDTH / img.width)), Image.LANCZOS)
            img.save(dest, "WEBP", quality=72, method=6)
            print("saved", dest.name, dest.stat().st_size // 1024, "KB")


if __name__ == "__main__":
    main()
