import type { Equipment, Experience, MuscleGroup } from '../core/types';
import { LIBRARY_ROWS } from './library';
import type { MotionId } from './motions';

export type Prop = 'none' | 'barbell' | 'dumbbell' | 'kettlebell' | 'handle';

export interface Exercise {
  id: string;
  name: string;
  primary: MuscleGroup;
  secondary: MuscleGroup[];
  /** Any one of these is enough to perform the exercise. */
  equipment: Equipment[];
  level: Experience;
  compound: boolean;
  motion: MotionId;
  prop: Prop;
  /** Empty for library exercises: load them with exerciseDetails(). */
  steps: string[];
  tip: string;
  /** Extended library: searchable and addable by hand, never picked for generated plans. */
  library?: boolean;
  /** Done for a time (a hold or an interval): a set's `reps` holds the seconds worked. */
  timed?: boolean;
}

export type ExerciseDetails = Pick<Exercise, 'steps' | 'tip'>;

const e = (x: Exercise) => x;

/** Hand-picked exercises with short guides. Generated plans and the wheel draw only on these. */
export const CORE_EXERCISES: readonly Exercise[] = [
  // Chest
  e({ id: 'push-up', name: 'Push-up', primary: 'chest', secondary: ['triceps', 'shoulders', 'core'], equipment: ['bodyweight'], level: 'beginner', compound: true, motion: 'pushup', prop: 'none',
    steps: ['Hands slightly wider than shoulders, body in a straight line.', 'Lower your chest until it nearly touches the floor.', 'Push back up, keeping hips level.'],
    tip: 'Too hard? Put your hands on a bench (incline) or your knees on the floor.' }),
  e({ id: 'incline-push-up', name: 'Incline Push-up', primary: 'chest', secondary: ['triceps', 'shoulders'], equipment: ['bodyweight'], level: 'beginner', compound: true, motion: 'pushup', prop: 'none',
    steps: ['Place hands on a bench or sturdy box.', 'Keep a straight line from head to heels.', 'Lower chest to the edge, then press away.'],
    tip: 'The higher the surface, the easier the exercise.' }),
  e({ id: 'bench-press', name: 'Barbell Bench Press', primary: 'chest', secondary: ['triceps', 'shoulders'], equipment: ['barbell'], level: 'intermediate', compound: true, motion: 'bench-press', prop: 'barbell',
    steps: ['Lie on the bench, eyes under the bar, feet flat.', 'Grip slightly wider than shoulders and unrack.', 'Lower the bar to mid-chest with control.', 'Press up until arms are straight.'],
    tip: 'Always use a spotter or safety arms when going heavy.' }),
  e({ id: 'dumbbell-bench-press', name: 'Dumbbell Bench Press', primary: 'chest', secondary: ['triceps', 'shoulders'], equipment: ['dumbbell'], level: 'beginner', compound: true, motion: 'bench-press', prop: 'dumbbell',
    steps: ['Lie on a bench holding dumbbells above your chest.', 'Lower them to the sides of your chest.', 'Press up and slightly together.'],
    tip: 'Keep your shoulder blades squeezed against the bench.' }),
  e({ id: 'machine-chest-press', name: 'Machine Chest Press', primary: 'chest', secondary: ['triceps', 'shoulders'], equipment: ['machine'], level: 'beginner', compound: true, motion: 'chest-press', prop: 'handle',
    steps: ['Adjust the seat so handles line up with mid-chest.', 'Press the handles forward until arms are straight.', 'Return slowly without letting the weights touch.'],
    tip: 'A great safe option to learn pressing strength.' }),
  e({ id: 'cable-fly', name: 'Cable / Band Fly', primary: 'chest', secondary: ['shoulders'], equipment: ['cable', 'band'], level: 'beginner', compound: false, motion: 'fly', prop: 'handle',
    steps: ['Stand between two cable handles (or a band anchored behind you).', 'With a soft bend in the elbows, bring your hands together in front.', 'Open back up slowly until you feel a chest stretch.'],
    tip: 'Think of hugging a big tree; the elbow angle stays fixed.' }),
  e({ id: 'incline-dumbbell-press', name: 'Incline Dumbbell Press', primary: 'chest', secondary: ['shoulders', 'triceps'], equipment: ['dumbbell'], level: 'beginner', compound: true, motion: 'bench-press', prop: 'dumbbell',
    steps: ['Set a bench to about 30–45 degrees and hold dumbbells at your shoulders.', 'Press up until your arms are straight.', 'Lower slowly to the sides of your upper chest.'],
    tip: 'A lower bench angle keeps the work on the chest, not the shoulders.' }),
  e({ id: 'incline-bench-press', name: 'Incline Barbell Bench Press', primary: 'chest', secondary: ['shoulders', 'triceps'], equipment: ['barbell'], level: 'intermediate', compound: true, motion: 'bench-press', prop: 'barbell',
    steps: ['Lie on an incline bench and grip slightly wider than shoulders.', 'Unrack and lower the bar to your upper chest.', 'Press up until your arms are straight.'],
    tip: 'Use a spotter or safety arms when going heavy.' }),
  e({ id: 'decline-bench-press', name: 'Decline Barbell Bench Press', primary: 'chest', secondary: ['triceps', 'shoulders'], equipment: ['barbell'], level: 'intermediate', compound: true, motion: 'bench-press', prop: 'barbell',
    steps: ['Hook your legs under the pads and lie back.', 'Unrack and lower the bar to your lower chest.', 'Press up until your arms are straight.'],
    tip: 'Have a spotter hand you the bar; it is awkward to unrack alone.' }),
  e({ id: 'dumbbell-fly', name: 'Dumbbell Fly', primary: 'chest', secondary: ['shoulders'], equipment: ['dumbbell'], level: 'beginner', compound: false, motion: 'fly', prop: 'dumbbell',
    steps: ['Lie on a bench with dumbbells above your chest, palms facing.', 'With a soft bend in the elbows, open your arms wide.', 'Stop at a chest stretch, then bring the weights back together.'],
    tip: 'Go lighter than you would for presses; the elbow angle stays fixed.' }),
  e({ id: 'pec-deck', name: 'Pec Deck Fly', primary: 'chest', secondary: ['shoulders'], equipment: ['machine'], level: 'beginner', compound: false, motion: 'fly', prop: 'handle',
    steps: ['Adjust the seat so the handles line up with your chest.', 'Bring the handles together in front of you.', 'Open back up slowly until you feel a chest stretch.'],
    tip: 'Keep your back flat against the pad.' }),
  e({ id: 'wide-push-up', name: 'Wide Push-up', primary: 'chest', secondary: ['shoulders', 'triceps'], equipment: ['bodyweight'], level: 'beginner', compound: true, motion: 'pushup', prop: 'none',
    steps: ['Set your hands well outside your shoulders, body in a straight line.', 'Lower your chest toward the floor.', 'Push back up, keeping your hips level.'],
    tip: 'If your shoulders complain, bring your hands a little closer.' }),
  e({ id: 'decline-push-up', name: 'Decline Push-up', primary: 'chest', secondary: ['shoulders', 'triceps'], equipment: ['bodyweight'], level: 'intermediate', compound: true, motion: 'pushup', prop: 'none',
    steps: ['Put your feet on a bench or box, hands on the floor.', 'Lower your chest toward the floor.', 'Push back up without letting your hips sag.'],
    tip: 'The higher your feet, the harder it gets.' }),
  // Back
  e({ id: 'pull-up', name: 'Pull-up', primary: 'back', secondary: ['biceps', 'core'], equipment: ['bodyweight'], level: 'intermediate', compound: true, motion: 'pullup', prop: 'none',
    steps: ['Hang from a bar, palms facing away, hands shoulder-width or wider.', 'Pull your chest toward the bar.', 'Lower all the way down with control.'],
    tip: 'Use a resistance band under your feet for assistance.' }),
  e({ id: 'chin-up', name: 'Chin-up', primary: 'biceps', secondary: ['back'], equipment: ['bodyweight'], level: 'intermediate', compound: true, motion: 'pullup', prop: 'none',
    steps: ['Hang from a bar with palms facing you.', 'Pull until your chin passes the bar.', 'Lower slowly to a full hang.'],
    tip: 'Usually a little easier than a pull-up.' }),
  e({ id: 'lat-pulldown', name: 'Lat Pulldown', primary: 'back', secondary: ['biceps'], equipment: ['machine', 'cable'], level: 'beginner', compound: true, motion: 'pulldown', prop: 'handle',
    steps: ['Sit with thighs under the pads, grip the bar wide.', 'Pull the bar down to your upper chest.', 'Let it rise slowly until arms are straight.'],
    tip: 'Lead with the elbows; avoid leaning far back.' }),
  e({ id: 'barbell-row', name: 'Barbell Bent-over Row', primary: 'back', secondary: ['biceps', 'core'], equipment: ['barbell'], level: 'intermediate', compound: true, motion: 'row', prop: 'barbell',
    steps: ['Hinge at the hips with a flat back, bar hanging at arm length.', 'Row the bar to your lower ribs.', 'Lower it under control.'],
    tip: 'Keep your spine neutral; do not round your lower back.' }),
  e({ id: 'dumbbell-row', name: 'One-arm Dumbbell Row', primary: 'back', secondary: ['biceps'], equipment: ['dumbbell', 'kettlebell'], level: 'beginner', compound: true, motion: 'row', prop: 'dumbbell',
    steps: ['Support one hand and knee on a bench.', 'Pull the dumbbell toward your hip.', 'Lower until the arm is straight. Switch sides.'],
    tip: 'Squeeze your shoulder blade back at the top.' }),
  e({ id: 'seated-cable-row', name: 'Seated Cable Row', primary: 'back', secondary: ['biceps'], equipment: ['cable', 'machine', 'band'], level: 'beginner', compound: true, motion: 'seated-row', prop: 'handle',
    steps: ['Sit tall with feet on the platform and knees slightly bent.', 'Pull the handle to your stomach.', 'Extend arms forward slowly.'],
    tip: 'Keep your torso still; the arms and back do the work.' }),
  e({ id: 'deadlift', name: 'Deadlift', primary: 'back', secondary: ['legs', 'glutes', 'core'], equipment: ['barbell'], level: 'advanced', compound: true, motion: 'hinge', prop: 'barbell',
    steps: ['Bar over mid-foot, grip just outside the knees.', 'Brace your core, flat back, chest up.', 'Push the floor away and stand tall.', 'Lower by pushing hips back.'],
    tip: 'Learn this with light weight first; form beats load.' }),
  e({ id: 'inverted-row', name: 'Inverted Row', primary: 'back', secondary: ['biceps', 'core'], equipment: ['bodyweight'], level: 'beginner', compound: true, motion: 'row', prop: 'none',
    steps: ['Lie under a low, secure bar and grip it just wider than shoulders.', 'Keep your body straight and pull your chest to the bar.', 'Lower until your arms are straight.'],
    tip: 'Bend your knees to make it easier; a good step toward pull-ups.' }),
  e({ id: 'back-extension', name: 'Back Extension', primary: 'back', secondary: ['glutes', 'legs'], equipment: ['machine'], level: 'beginner', compound: false, motion: 'hinge', prop: 'none',
    steps: ['Set the pad just below your hips and cross your arms.', 'Bend forward at the hips with a flat back.', 'Rise until your body forms a straight line.'],
    tip: 'Stop at straight; do not arch past it.' }),
  e({ id: 'superman', name: 'Superman', primary: 'back', secondary: ['glutes'], equipment: ['bodyweight'], level: 'beginner', compound: false, motion: 'plank', prop: 'none',
    steps: ['Lie face down with your arms stretched out in front.', 'Lift your arms, chest and legs off the floor together.', 'Hold for a moment, then lower.'],
    tip: 'Lift only as far as feels comfortable; keep your neck long.' }),
  e({ id: 'two-dumbbell-row', name: 'Bent-over Dumbbell Row', primary: 'back', secondary: ['biceps', 'core'], equipment: ['dumbbell'], level: 'beginner', compound: true, motion: 'row', prop: 'dumbbell',
    steps: ['Hinge at the hips with a flat back, dumbbells hanging down.', 'Pull both dumbbells to your lower ribs.', 'Lower until your arms are straight.'],
    tip: 'Keep your torso still; do not bounce to lift the weight.' }),
  e({ id: 't-bar-row', name: 'T-bar Row', primary: 'back', secondary: ['biceps', 'core'], equipment: ['barbell'], level: 'intermediate', compound: true, motion: 'row', prop: 'barbell',
    steps: ['Wedge one end of a bar in a corner and load the other.', 'Hinge forward with a flat back and hold the bar near the plates.', 'Row the bar to your chest, then lower it with control.'],
    tip: 'Keep your chest up and your lower back flat.' }),
  e({ id: 'machine-row', name: 'Machine Row', primary: 'back', secondary: ['biceps'], equipment: ['machine'], level: 'beginner', compound: true, motion: 'seated-row', prop: 'handle',
    steps: ['Set the seat so the handles are at chest height.', 'Pull the handles back, squeezing your shoulder blades.', 'Extend your arms slowly.'],
    tip: 'Keep your chest on the pad and let your back do the pulling.' }),
  e({ id: 'close-grip-pulldown', name: 'Close-grip Pulldown', primary: 'back', secondary: ['biceps'], equipment: ['machine', 'cable'], level: 'beginner', compound: true, motion: 'pulldown', prop: 'handle',
    steps: ['Sit with thighs under the pads and grip the bar narrowly.', 'Pull the bar to your upper chest.', 'Let it rise slowly until your arms are straight.'],
    tip: 'Lead with your elbows and stay nearly upright.' }),
  e({ id: 'straight-arm-pulldown', name: 'Straight-arm Pulldown', primary: 'back', secondary: ['core'], equipment: ['cable', 'band'], level: 'beginner', compound: false, motion: 'pulldown', prop: 'handle',
    steps: ['Stand facing a high cable and hold the bar with straight arms.', 'Sweep the bar down to your thighs.', 'Let it rise slowly to about eye level.'],
    tip: 'Keep a soft, fixed bend in your elbows; this is not a pushdown.' }),
  // Shoulders
  e({ id: 'overhead-press', name: 'Barbell Overhead Press', primary: 'shoulders', secondary: ['triceps', 'core'], equipment: ['barbell'], level: 'intermediate', compound: true, motion: 'overhead-press', prop: 'barbell',
    steps: ['Stand with the bar at your collarbones.', 'Brace and press the bar straight overhead.', 'Lower back to the start.'],
    tip: 'Squeeze your glutes to avoid arching your lower back.' }),
  e({ id: 'dumbbell-shoulder-press', name: 'Dumbbell Shoulder Press', primary: 'shoulders', secondary: ['triceps'], equipment: ['dumbbell', 'kettlebell'], level: 'beginner', compound: true, motion: 'overhead-press', prop: 'dumbbell',
    steps: ['Hold dumbbells at shoulder height.', 'Press overhead until arms are straight.', 'Lower with control.'],
    tip: 'Can be done seated for more stability.' }),
  e({ id: 'pike-push-up', name: 'Pike Push-up', primary: 'shoulders', secondary: ['triceps'], equipment: ['bodyweight'], level: 'intermediate', compound: true, motion: 'pushup', prop: 'none',
    steps: ['Start in a push-up then lift hips high (an upside-down V).', 'Bend elbows to lower your head toward the floor.', 'Press back up.'],
    tip: 'A no-equipment way to train overhead pressing.' }),
  e({ id: 'lateral-raise', name: 'Lateral Raise', primary: 'shoulders', secondary: [], equipment: ['dumbbell', 'cable', 'band'], level: 'beginner', compound: false, motion: 'lateral-raise', prop: 'dumbbell',
    steps: ['Stand holding light weights at your sides.', 'Raise arms out to shoulder height.', 'Lower slowly.'],
    tip: 'Light weight and control matter more than heavy weight here.' }),
  e({ id: 'front-raise', name: 'Front Raise', primary: 'shoulders', secondary: [], equipment: ['dumbbell', 'cable', 'band'], level: 'beginner', compound: false, motion: 'front-raise', prop: 'dumbbell',
    steps: ['Hold weights in front of your thighs.', 'Raise one or both arms forward to shoulder height.', 'Lower with control.'],
    tip: 'Avoid swinging; keep the torso still.' }),
  e({ id: 'shrug', name: 'Shrug', primary: 'shoulders', secondary: ['back'], equipment: ['dumbbell', 'barbell', 'kettlebell'], level: 'beginner', compound: false, motion: 'shrug', prop: 'dumbbell',
    steps: ['Hold weights at your sides.', 'Lift your shoulders straight up toward your ears.', 'Pause, then lower.'],
    tip: 'Do not roll the shoulders; straight up and down.' }),
  e({ id: 'arnold-press', name: 'Arnold Press', primary: 'shoulders', secondary: ['triceps'], equipment: ['dumbbell'], level: 'intermediate', compound: true, motion: 'overhead-press', prop: 'dumbbell',
    steps: ['Sit with dumbbells at chest height, palms facing you.', 'Press up, turning your palms to face forward.', 'Reverse the turn as you lower.'],
    tip: 'Start lighter than your usual shoulder press.' }),
  e({ id: 'face-pull', name: 'Face Pull', primary: 'shoulders', secondary: ['back'], equipment: ['cable', 'band'], level: 'intermediate', compound: false, motion: 'seated-row', prop: 'handle',
    steps: ['Set a rope at face height and hold it with both hands.', 'Pull it toward your forehead, elbows high and wide.', 'Extend your arms slowly.'],
    tip: 'Great for shoulder health; keep the weight light.' }),
  e({ id: 'reverse-fly', name: 'Reverse Fly', primary: 'shoulders', secondary: ['back'], equipment: ['dumbbell', 'cable', 'band'], level: 'beginner', compound: false, motion: 'lateral-raise', prop: 'dumbbell',
    steps: ['Lean forward with your chest on an incline bench or hinge at the hips.', 'With soft elbows, raise your arms out to the sides.', 'Lower with control.'],
    tip: 'Think of squeezing your shoulder blades together.' }),
  e({ id: 'upright-row', name: 'Barbell Upright Row', primary: 'shoulders', secondary: ['back', 'biceps'], equipment: ['barbell'], level: 'intermediate', compound: true, motion: 'shrug', prop: 'barbell',
    steps: ['Stand with the bar at your thighs, hands about shoulder-width.', 'Pull it up close to your body, elbows leading.', 'Stop at chest height, then lower.'],
    tip: 'If it pinches your shoulders, stop lower or swap for a lateral raise.' }),
  e({ id: 'machine-shoulder-press', name: 'Machine Shoulder Press', primary: 'shoulders', secondary: ['triceps'], equipment: ['machine'], level: 'beginner', compound: true, motion: 'overhead-press', prop: 'handle',
    steps: ['Set the seat so the handles start at shoulder height.', 'Press up until your arms are straight.', 'Lower slowly without letting the weights touch.'],
    tip: 'A stable way to learn overhead pressing.' }),
  e({ id: 'band-pull-apart', name: 'Band Pull-apart', primary: 'shoulders', secondary: ['back'], equipment: ['band'], level: 'beginner', compound: false, motion: 'fly', prop: 'handle',
    steps: ['Hold a band in front of you at shoulder height, arms straight.', 'Pull your hands apart until the band reaches your chest.', 'Return slowly.'],
    tip: 'Use it as a warm-up before pressing.' }),
  // Arms
  e({ id: 'dumbbell-curl', name: 'Dumbbell Biceps Curl', primary: 'biceps', secondary: [], equipment: ['dumbbell', 'kettlebell'], level: 'beginner', compound: false, motion: 'curl', prop: 'dumbbell',
    steps: ['Stand with dumbbells at your sides, palms forward.', 'Curl the weights up, keeping elbows by your sides.', 'Lower slowly.'],
    tip: 'Slow lowering (3 seconds) builds more muscle.' }),
  e({ id: 'barbell-curl', name: 'Barbell Curl', primary: 'biceps', secondary: [], equipment: ['barbell'], level: 'beginner', compound: false, motion: 'curl', prop: 'barbell',
    steps: ['Hold the bar shoulder-width, palms up.', 'Curl it to your shoulders.', 'Lower to full extension.'],
    tip: 'Keep your back still; no swinging.' }),
  e({ id: 'hammer-curl', name: 'Hammer Curl', primary: 'biceps', secondary: [], equipment: ['dumbbell'], level: 'beginner', compound: false, motion: 'curl', prop: 'dumbbell',
    steps: ['Hold dumbbells with palms facing each other.', 'Curl up keeping the neutral grip.', 'Lower slowly.'],
    tip: 'Also trains the forearms.' }),
  e({ id: 'band-curl', name: 'Band / Cable Curl', primary: 'biceps', secondary: [], equipment: ['band', 'cable'], level: 'beginner', compound: false, motion: 'curl', prop: 'handle',
    steps: ['Stand on the band (or face a low cable).', 'Curl the handles up.', 'Lower with control.'],
    tip: 'Constant tension makes this great for finishing a workout.' }),
  e({ id: 'bench-dip', name: 'Bench Dip', primary: 'triceps', secondary: ['chest', 'shoulders'], equipment: ['bodyweight'], level: 'beginner', compound: true, motion: 'dip', prop: 'none',
    steps: ['Hands on the edge of a bench behind you.', 'Bend elbows to lower your body.', 'Press back up.'],
    tip: 'Stop if you feel shoulder pain; do not go too deep.' }),
  e({ id: 'parallel-dip', name: 'Parallel Bar Dip', primary: 'triceps', secondary: ['chest', 'shoulders'], equipment: ['bodyweight'], level: 'intermediate', compound: true, motion: 'dip', prop: 'none',
    steps: ['Support yourself on parallel bars with straight arms.', 'Lower until upper arms are about parallel to the floor.', 'Press back up.'],
    tip: 'Lean forward to target chest more, stay upright for triceps.' }),
  e({ id: 'overhead-triceps-extension', name: 'Overhead Triceps Extension', primary: 'triceps', secondary: [], equipment: ['dumbbell', 'cable', 'band'], level: 'beginner', compound: false, motion: 'triceps-overhead', prop: 'dumbbell',
    steps: ['Hold one dumbbell overhead with both hands.', 'Lower it behind your head by bending the elbows.', 'Extend back up.'],
    tip: 'Keep elbows pointing forward, close to your head.' }),
  e({ id: 'triceps-pushdown', name: 'Triceps Pushdown', primary: 'triceps', secondary: [], equipment: ['cable', 'band'], level: 'beginner', compound: false, motion: 'pushdown', prop: 'handle',
    steps: ['Face a high cable/band with elbows at your sides.', 'Push the handle down until arms are straight.', 'Let it return slowly.'],
    tip: 'Only the forearms move; elbows stay pinned.' }),
  e({ id: 'diamond-push-up', name: 'Diamond Push-up', primary: 'triceps', secondary: ['chest'], equipment: ['bodyweight'], level: 'intermediate', compound: true, motion: 'pushup', prop: 'none',
    steps: ['Push-up position with hands together under your chest.', 'Lower with elbows close to your body.', 'Press up.'],
    tip: 'Do it from your knees to start.' }),
  e({ id: 'incline-dumbbell-curl', name: 'Incline Dumbbell Curl', primary: 'biceps', secondary: [], equipment: ['dumbbell'], level: 'beginner', compound: false, motion: 'curl', prop: 'dumbbell',
    steps: ['Sit back on an incline bench, arms hanging straight down.', 'Curl the weights up without moving your elbows forward.', 'Lower slowly to a full stretch.'],
    tip: 'Go lighter than a standing curl; the stretch makes it harder.' }),
  e({ id: 'concentration-curl', name: 'Concentration Curl', primary: 'biceps', secondary: [], equipment: ['dumbbell'], level: 'beginner', compound: false, motion: 'curl', prop: 'dumbbell',
    steps: ['Sit on a bench and rest your elbow against your inner thigh.', 'Curl the dumbbell toward your shoulder.', 'Lower until your arm is straight. Switch sides.'],
    tip: 'Only your forearm moves.' }),
  e({ id: 'preacher-curl', name: 'Preacher Curl', primary: 'biceps', secondary: [], equipment: ['barbell'], level: 'beginner', compound: false, motion: 'curl', prop: 'barbell',
    steps: ['Sit at a preacher bench with your upper arms on the pad.', 'Curl the bar up toward your shoulders.', 'Lower slowly until your arms are almost straight.'],
    tip: 'Do not drop the last few inches; control protects your elbows.' }),
  e({ id: 'reverse-curl', name: 'Reverse Curl', primary: 'biceps', secondary: [], equipment: ['barbell'], level: 'beginner', compound: false, motion: 'curl', prop: 'barbell',
    steps: ['Hold the bar shoulder-width with your palms facing down.', 'Curl it up, keeping your elbows by your sides.', 'Lower with control.'],
    tip: 'Also trains your forearms, so use less weight than a normal curl.' }),
  e({ id: 'cable-hammer-curl', name: 'Rope Hammer Curl', primary: 'biceps', secondary: [], equipment: ['cable'], level: 'beginner', compound: false, motion: 'curl', prop: 'handle',
    steps: ['Attach a rope to a low cable, palms facing each other.', 'Curl the rope up, keeping your elbows by your sides.', 'Lower slowly.'],
    tip: 'The cable keeps tension on the muscle the whole way.' }),
  e({ id: 'close-grip-bench-press', name: 'Close-grip Bench Press', primary: 'triceps', secondary: ['chest', 'shoulders'], equipment: ['barbell'], level: 'intermediate', compound: true, motion: 'bench-press', prop: 'barbell',
    steps: ['Lie on a bench and grip the bar about shoulder-width.', 'Lower it to your lower chest, elbows close to your body.', 'Press up until your arms are straight.'],
    tip: 'Hands closer than shoulder-width only strains your wrists.' }),
  e({ id: 'skull-crusher', name: 'Skull Crusher', primary: 'triceps', secondary: [], equipment: ['barbell'], level: 'intermediate', compound: false, motion: 'triceps-overhead', prop: 'barbell',
    steps: ['Lie on a bench with a bar or EZ bar above your chest.', 'Bend only your elbows to lower it toward your forehead.', 'Straighten your arms to return.'],
    tip: 'Keep your upper arms still, and start light.' }),
  e({ id: 'triceps-kickback', name: 'Triceps Kickback', primary: 'triceps', secondary: [], equipment: ['dumbbell'], level: 'beginner', compound: false, motion: 'pushdown', prop: 'dumbbell',
    steps: ['Lean forward with one hand on a bench, upper arm by your side.', 'Straighten your arm behind you.', 'Bend it back to 90 degrees. Switch sides.'],
    tip: 'Hold the top for a second; a light weight is plenty.' }),
  e({ id: 'rope-overhead-extension', name: 'Rope Overhead Extension', primary: 'triceps', secondary: [], equipment: ['cable'], level: 'beginner', compound: false, motion: 'triceps-overhead', prop: 'handle',
    steps: ['Hold a rope from a low cable behind your head, facing away.', 'Straighten your arms overhead.', 'Bend your elbows to lower it behind your head.'],
    tip: 'Keep your elbows pointing forward, not out to the sides.' }),
  e({ id: 'machine-dip', name: 'Machine Dip', primary: 'triceps', secondary: ['chest', 'shoulders'], equipment: ['machine'], level: 'beginner', compound: true, motion: 'dip', prop: 'handle',
    steps: ['Sit with your hands on the handles by your sides.', 'Press down until your arms are straight.', 'Let the handles rise slowly.'],
    tip: 'A safer way to build up to full dips.' }),
  // Legs
  e({ id: 'bodyweight-squat', name: 'Bodyweight Squat', primary: 'legs', secondary: ['glutes', 'core'], equipment: ['bodyweight'], level: 'beginner', compound: true, motion: 'squat', prop: 'none',
    steps: ['Feet shoulder-width apart, toes slightly out.', 'Sit back and down, keeping chest up.', 'Go as low as is comfortable, then stand.'],
    tip: 'Knees follow the direction of your toes.' }),
  e({ id: 'goblet-squat', name: 'Goblet Squat', primary: 'legs', secondary: ['glutes', 'core'], equipment: ['dumbbell', 'kettlebell'], level: 'beginner', compound: true, motion: 'squat-goblet', prop: 'kettlebell',
    steps: ['Hold a weight against your chest.', 'Squat down between your knees.', 'Drive up through your heels.'],
    tip: 'The best way to learn a good squat.' }),
  e({ id: 'barbell-squat', name: 'Barbell Back Squat', primary: 'legs', secondary: ['glutes', 'core'], equipment: ['barbell'], level: 'intermediate', compound: true, motion: 'squat-barbell', prop: 'barbell',
    steps: ['Bar on your upper back, feet shoulder-width.', 'Brace, then squat until thighs are about parallel.', 'Stand up driving through the whole foot.'],
    tip: 'Use the safety bars of the rack.' }),
  e({ id: 'lunge', name: 'Lunge', primary: 'legs', secondary: ['glutes'], equipment: ['bodyweight', 'dumbbell', 'kettlebell'], level: 'beginner', compound: true, motion: 'lunge', prop: 'none',
    steps: ['Step forward with one leg.', 'Lower until both knees are about 90°.', 'Push back to standing; alternate legs.'],
    tip: 'Keep your torso upright.' }),
  e({ id: 'bulgarian-split-squat', name: 'Bulgarian Split Squat', primary: 'legs', secondary: ['glutes'], equipment: ['bodyweight', 'dumbbell'], level: 'intermediate', compound: true, motion: 'lunge', prop: 'dumbbell',
    steps: ['Rear foot on a bench behind you.', 'Lower straight down on the front leg.', 'Drive up through the front heel.'],
    tip: 'Hold onto something for balance at first.' }),
  e({ id: 'leg-press', name: 'Leg Press', primary: 'legs', secondary: ['glutes'], equipment: ['machine'], level: 'beginner', compound: true, motion: 'leg-press', prop: 'none',
    steps: ['Sit with feet shoulder-width on the platform.', 'Release the safety and lower the platform toward you.', 'Press back without locking your knees.'],
    tip: 'Keep your lower back flat against the pad.' }),
  e({ id: 'leg-extension', name: 'Leg Extension', primary: 'legs', secondary: [], equipment: ['machine', 'band'], level: 'beginner', compound: false, motion: 'leg-extension', prop: 'none',
    steps: ['Sit with the pad on your lower shins.', 'Straighten your legs.', 'Lower slowly.'],
    tip: 'Isolates the front of the thigh (quadriceps).' }),
  e({ id: 'leg-curl', name: 'Leg Curl', primary: 'legs', secondary: [], equipment: ['machine', 'band'], level: 'beginner', compound: false, motion: 'leg-extension', prop: 'none',
    steps: ['Sit or lie with the pad behind your ankles.', 'Curl your heels toward you.', 'Return slowly.'],
    tip: 'Targets the back of the thigh (hamstrings).' }),
  e({ id: 'romanian-deadlift', name: 'Romanian Deadlift', primary: 'legs', secondary: ['glutes', 'back'], equipment: ['barbell', 'dumbbell', 'kettlebell'], level: 'intermediate', compound: true, motion: 'hinge', prop: 'dumbbell',
    steps: ['Stand holding the weight, knees slightly bent.', 'Push hips back, sliding the weight down your legs.', 'Stop when you feel a hamstring stretch, then stand.'],
    tip: 'Back stays flat the whole time.' }),
  e({ id: 'front-squat', name: 'Barbell Front Squat', primary: 'legs', secondary: ['glutes', 'core'], equipment: ['barbell'], level: 'intermediate', compound: true, motion: 'squat-barbell', prop: 'barbell',
    steps: ['Rest the bar on the front of your shoulders, elbows high.', 'Sit down between your hips, chest up.', 'Drive up through your whole foot.'],
    tip: 'If your elbows drop, the bar will roll forward.' }),
  e({ id: 'smith-machine-squat', name: 'Smith Machine Squat', primary: 'legs', secondary: ['glutes'], equipment: ['machine'], level: 'beginner', compound: true, motion: 'squat-barbell', prop: 'barbell',
    steps: ['Set the bar across your upper back, feet slightly forward.', 'Unhook it and squat until your thighs are level with the floor.', 'Push back up through your heels.'],
    tip: 'The fixed bar makes this a good first loaded squat.' }),
  e({ id: 'dumbbell-lunge', name: 'Dumbbell Lunge', primary: 'legs', secondary: ['glutes'], equipment: ['dumbbell', 'kettlebell'], level: 'beginner', compound: true, motion: 'lunge', prop: 'dumbbell',
    steps: ['Stand tall with weights at your sides.', 'Step forward and lower your back knee toward the floor.', 'Push off your front foot to stand. Switch legs.'],
    tip: 'Take a long enough step that your front heel stays down.' }),
  e({ id: 'step-up', name: 'Step-up', primary: 'legs', secondary: ['glutes'], equipment: ['bodyweight', 'dumbbell'], level: 'beginner', compound: true, motion: 'lunge', prop: 'dumbbell',
    steps: ['Stand facing a sturdy bench or box.', 'Place one foot on top and drive up through that heel.', 'Step down slowly. Switch legs.'],
    tip: 'Use a lower step if your knee moves past your toes.' }),
  e({ id: 'lying-leg-curl', name: 'Lying Leg Curl', primary: 'legs', secondary: [], equipment: ['machine'], level: 'beginner', compound: false, motion: 'leg-extension', prop: 'none',
    steps: ['Lie face down with the pad just above your heels.', 'Curl your heels toward your glutes.', 'Lower slowly.'],
    tip: 'Keep your hips pressed into the bench.' }),
  e({ id: 'sumo-squat', name: 'Sumo Dumbbell Squat', primary: 'legs', secondary: ['glutes'], equipment: ['dumbbell', 'kettlebell'], level: 'beginner', compound: true, motion: 'squat-goblet', prop: 'dumbbell',
    steps: ['Stand with feet wide and toes out, holding one weight between your legs.', 'Squat straight down, knees following your toes.', 'Stand back up and squeeze your glutes.'],
    tip: 'The wide stance works the inner thighs too.' }),
  e({ id: 'good-morning', name: 'Good Morning', primary: 'legs', secondary: ['back', 'glutes'], equipment: ['barbell'], level: 'intermediate', compound: true, motion: 'hinge', prop: 'barbell',
    steps: ['Rest a light bar across your upper back, knees soft.', 'Push your hips back and lean forward with a flat back.', 'Stand back up by driving your hips forward.'],
    tip: 'Start with an empty bar; this one is about form, not load.' }),
  // Glutes
  e({ id: 'glute-bridge', name: 'Glute Bridge', primary: 'glutes', secondary: ['legs', 'core'], equipment: ['bodyweight', 'band'], level: 'beginner', compound: false, motion: 'bridge', prop: 'none',
    steps: ['Lie on your back, knees bent, feet flat.', 'Squeeze glutes and lift hips.', 'Pause at the top, then lower.'],
    tip: 'Push through your heels.' }),
  e({ id: 'hip-thrust', name: 'Barbell Hip Thrust', primary: 'glutes', secondary: ['legs'], equipment: ['barbell', 'dumbbell'], level: 'intermediate', compound: true, motion: 'bridge', prop: 'barbell',
    steps: ['Upper back on a bench, weight across your hips.', 'Drive hips up until your body is flat.', 'Lower under control.'],
    tip: 'Use a pad on the bar for comfort.' }),
  e({ id: 'kettlebell-swing', name: 'Kettlebell Swing', primary: 'glutes', secondary: ['legs', 'back', 'cardio'], equipment: ['kettlebell', 'dumbbell'], level: 'intermediate', compound: true, motion: 'hinge', prop: 'kettlebell',
    steps: ['Hinge and hike the kettlebell back between your legs.', 'Snap your hips forward to swing it to chest height.', 'Let it fall back and repeat.'],
    tip: 'The power comes from the hips, not the arms.' }),
  e({ id: 'single-leg-glute-bridge', name: 'Single-leg Glute Bridge', primary: 'glutes', secondary: ['legs', 'core'], equipment: ['bodyweight'], level: 'beginner', compound: false, motion: 'bridge', prop: 'none',
    steps: ['Lie on your back with one knee bent and the other leg raised.', 'Push through your heel and lift your hips.', 'Lower slowly. Switch legs.'],
    tip: 'Keep your hips level; do not let one side drop.' }),
  e({ id: 'glute-kickback', name: 'Glute Kickback', primary: 'glutes', secondary: ['legs'], equipment: ['bodyweight', 'band'], level: 'beginner', compound: false, motion: 'bridge', prop: 'none',
    steps: ['Start on your hands and knees.', 'Push one heel up and back until your thigh is level with your body.', 'Lower with control. Switch legs.'],
    tip: 'Move from the hip without arching your lower back.' }),
  e({ id: 'cable-pull-through', name: 'Cable Pull-through', primary: 'glutes', secondary: ['legs', 'back'], equipment: ['cable', 'band'], level: 'beginner', compound: true, motion: 'hinge', prop: 'handle',
    steps: ['Face away from a low cable with the rope between your legs.', 'Push your hips back with a flat back.', 'Drive your hips forward to stand tall.'],
    tip: 'A friendly way to learn the hip hinge.' }),
  e({ id: 'hip-abduction', name: 'Hip Abduction Machine', primary: 'glutes', secondary: [], equipment: ['machine'], level: 'beginner', compound: false, motion: 'leg-extension', prop: 'none',
    steps: ['Sit with the pads against the outside of your knees.', 'Press your knees apart.', 'Return slowly without letting the weights touch.'],
    tip: 'Sit tall and keep the movement smooth.' }),
  // Calves
  e({ id: 'calf-raise', name: 'Standing Calf Raise', primary: 'calves', secondary: [], equipment: ['bodyweight', 'dumbbell', 'machine'], level: 'beginner', compound: false, motion: 'calf-raise', prop: 'none',
    steps: ['Stand on the edge of a step.', 'Rise up on your toes as high as possible.', 'Lower heels below the step.'],
    tip: 'Pause at the top for a second.' }),
  e({ id: 'seated-calf-raise', name: 'Seated Calf Raise', primary: 'calves', secondary: [], equipment: ['machine'], level: 'beginner', compound: false, motion: 'calf-raise', prop: 'none',
    steps: ['Sit with the balls of your feet on the platform and the pad on your thighs.', 'Lift your heels as high as you can.', 'Lower slowly to a full stretch.'],
    tip: 'Pause at the top and bottom instead of bouncing.' }),
  e({ id: 'barbell-calf-raise', name: 'Barbell Calf Raise', primary: 'calves', secondary: [], equipment: ['barbell'], level: 'beginner', compound: false, motion: 'calf-raise', prop: 'barbell',
    steps: ['Stand with a bar across your upper back.', 'Rise as high as you can onto your toes.', 'Lower slowly.'],
    tip: 'Stand on a low plate for a bigger stretch.' }),
  e({ id: 'leg-press-calf-raise', name: 'Leg Press Calf Raise', primary: 'calves', secondary: [], equipment: ['machine'], level: 'beginner', compound: false, motion: 'calf-raise', prop: 'none',
    steps: ['Sit in a leg press with the balls of your feet on the bottom edge.', 'Keeping your legs straight, push the plate away with your toes.', 'Let your heels come back slowly.'],
    tip: 'Keep the safety catches on and your feet firmly planted.' }),
  // Core
  e({ id: 'plank', name: 'Plank', primary: 'core', secondary: ['shoulders'], equipment: ['bodyweight'], level: 'beginner', compound: false, motion: 'plank', prop: 'none', timed: true,
    steps: ['Forearms on the floor, elbows under shoulders.', 'Keep a straight line from head to heels.', 'Hold while breathing steadily.'],
    tip: 'Stop as soon as your hips sag or rise.' }),
  e({ id: 'crunch', name: 'Crunch', primary: 'core', secondary: [], equipment: ['bodyweight'], level: 'beginner', compound: false, motion: 'crunch', prop: 'none',
    steps: ['Lie on your back with knees bent.', 'Curl your shoulders off the floor.', 'Lower slowly.'],
    tip: 'Do not pull on your neck.' }),
  e({ id: 'lying-leg-raise', name: 'Lying Leg Raise', primary: 'core', secondary: [], equipment: ['bodyweight'], level: 'beginner', compound: false, motion: 'leg-raise', prop: 'none',
    steps: ['Lie flat with legs straight.', 'Raise legs to vertical.', 'Lower slowly without touching the floor.'],
    tip: 'Press your lower back into the floor.' }),
  e({ id: 'mountain-climber', name: 'Mountain Climber', primary: 'core', secondary: ['cardio', 'shoulders'], equipment: ['bodyweight'], level: 'beginner', compound: true, motion: 'mountain-climber', prop: 'none',
    steps: ['Start in a high plank.', 'Drive one knee toward your chest.', 'Switch legs quickly.'],
    tip: 'Keep your hips low.' }),
  e({ id: 'sit-up', name: 'Sit-up', primary: 'core', secondary: [], equipment: ['bodyweight'], level: 'beginner', compound: false, motion: 'crunch', prop: 'none',
    steps: ['Lie on your back with knees bent and feet flat.', 'Curl your chest up toward your knees.', 'Lower yourself slowly.'],
    tip: 'Do not pull on your neck; your hands only rest by your head.' }),
  e({ id: 'reverse-crunch', name: 'Reverse Crunch', primary: 'core', secondary: [], equipment: ['bodyweight'], level: 'beginner', compound: false, motion: 'crunch', prop: 'none',
    steps: ['Lie on your back with knees bent and feet off the floor.', 'Curl your hips up toward your ribs.', 'Lower slowly without dropping your legs.'],
    tip: 'Lift with your abs, not by swinging your legs.' }),
  e({ id: 'bicycle-crunch', name: 'Bicycle Crunch', primary: 'core', secondary: [], equipment: ['bodyweight'], level: 'beginner', compound: false, motion: 'crunch', prop: 'none',
    steps: ['Lie on your back with your hands by your head and legs raised.', 'Bring one elbow toward the opposite knee as the other leg straightens.', 'Switch sides in a slow pedalling motion.'],
    tip: 'Slow and controlled beats fast and sloppy.' }),
  e({ id: 'russian-twist', name: 'Russian Twist', primary: 'core', secondary: [], equipment: ['bodyweight', 'dumbbell'], level: 'intermediate', compound: false, motion: 'crunch', prop: 'none',
    steps: ['Sit with knees bent and lean back slightly.', 'Hold your hands or a weight in front of your chest.', 'Turn your torso from side to side.'],
    tip: 'Keep your chest up; lift your feet to make it harder.' }),
  e({ id: 'dead-bug', name: 'Dead Bug', primary: 'core', secondary: [], equipment: ['bodyweight'], level: 'beginner', compound: false, motion: 'leg-raise', prop: 'none',
    steps: ['Lie on your back with arms up and knees bent over your hips.', 'Lower one leg and the opposite arm toward the floor.', 'Return, then switch sides.'],
    tip: 'Keep your lower back pressed into the floor.' }),
  e({ id: 'side-plank', name: 'Side Plank', primary: 'core', secondary: ['shoulders'], equipment: ['bodyweight'], level: 'beginner', compound: false, motion: 'plank', prop: 'none', timed: true,
    steps: ['Lie on your side with your elbow under your shoulder.', 'Lift your hips until your body is straight.', 'Hold, then lower. Switch sides.'],
    tip: 'Too hard? Bend your knees and rest them on the floor.' }),
  e({ id: 'cable-crunch', name: 'Cable Crunch', primary: 'core', secondary: [], equipment: ['cable'], level: 'beginner', compound: false, motion: 'crunch', prop: 'handle',
    steps: ['Kneel below a high cable and hold the rope by your head.', 'Curl your ribs toward your hips.', 'Rise slowly.'],
    tip: 'Your hips stay still; only your spine bends.' }),
  e({ id: 'pallof-press', name: 'Pallof Press', primary: 'core', secondary: ['shoulders'], equipment: ['cable', 'band'], level: 'beginner', compound: false, motion: 'chest-press', prop: 'handle',
    steps: ['Stand side-on to a cable or band with both hands at your chest.', 'Press your hands straight out and resist the twist.', 'Bring them back in. Switch sides.'],
    tip: 'The goal is to stay still; the pull is trying to turn you.' }),
  e({ id: 'side-bend', name: 'Dumbbell Side Bend', primary: 'core', secondary: [], equipment: ['dumbbell', 'kettlebell'], level: 'beginner', compound: false, motion: 'shrug', prop: 'dumbbell',
    steps: ['Stand tall with a weight in one hand.', 'Bend sideways toward the weight.', 'Pull yourself back upright. Switch sides.'],
    tip: 'Bend straight to the side without leaning forward.' }),
  // Cardio
  e({ id: 'jumping-jack', name: 'Jumping Jacks', primary: 'cardio', secondary: ['calves'], equipment: ['bodyweight'], level: 'beginner', compound: true, motion: 'jumping-jack', prop: 'none',
    steps: ['Stand with feet together, arms at sides.', 'Jump feet apart while raising arms overhead.', 'Jump back to start.'],
    tip: 'Step side-to-side instead of jumping for a low-impact version.' }),
  e({ id: 'high-knees', name: 'High Knees / Jog', primary: 'cardio', secondary: ['legs', 'core'], equipment: ['bodyweight', 'machine'], level: 'beginner', compound: true, motion: 'run', prop: 'none', timed: true,
    steps: ['Run in place (or on a treadmill).', 'Drive knees up to hip height.', 'Pump your arms.'],
    tip: 'For a longer steady run, use the day\'s cardio minutes instead.' }),
  e({ id: 'jump-rope', name: 'Jump Rope', primary: 'cardio', secondary: ['calves'], equipment: ['bodyweight'], level: 'beginner', compound: true, motion: 'jump', prop: 'none', timed: true,
    steps: ['Hold the rope handles at hip height.', 'Turn the rope with your wrists.', 'Small jumps on the balls of your feet.'],
    tip: 'No rope? Do the motion without one.' }),
  e({ id: 'burpee', name: 'Burpee', primary: 'cardio', secondary: ['chest', 'legs', 'core'], equipment: ['bodyweight'], level: 'intermediate', compound: true, motion: 'burpee', prop: 'none',
    steps: ['Squat down and place hands on the floor.', 'Jump feet back into a plank.', 'Jump feet in and leap up with arms overhead.'],
    tip: 'Skip the jump and step back for an easier version.' }),
  e({ id: 'rocket-jump', name: 'Rocket Jump', primary: 'cardio', secondary: ['legs'], equipment: ['bodyweight'], level: 'beginner', compound: true, motion: 'jump', prop: 'none',
    steps: ['Squat down with your hands by your feet.', 'Jump as high as you can, reaching overhead.', 'Land softly and sink back into the squat.'],
    tip: 'Land quietly with bent knees.' }),
  e({ id: 'tuck-jump', name: 'Tuck Jump', primary: 'cardio', secondary: ['legs', 'core'], equipment: ['bodyweight'], level: 'intermediate', compound: true, motion: 'jump', prop: 'none',
    steps: ['Stand with your feet hip-width apart.', 'Jump and bring your knees up toward your chest.', 'Land softly and go straight into the next jump.'],
    tip: 'Take a short rest between reps if your landings get heavy.' }),
  e({ id: 'split-jump', name: 'Split Jump', primary: 'cardio', secondary: ['legs', 'glutes'], equipment: ['bodyweight'], level: 'intermediate', compound: true, motion: 'lunge', prop: 'none',
    steps: ['Start in a lunge with one foot forward.', 'Jump up and swap your legs in the air.', 'Land softly in a lunge on the other side.'],
    tip: 'Step through the lunges instead for an easier version.' }),
  e({ id: 'skipping', name: 'Fast Skipping', primary: 'cardio', secondary: ['legs', 'calves'], equipment: ['bodyweight'], level: 'beginner', compound: true, motion: 'run', prop: 'none', timed: true,
    steps: ['Skip forward, driving one knee up as you hop.', 'Swing your opposite arm with each knee.', 'Keep a quick, light rhythm.'],
    tip: 'Stay on the balls of your feet.' }),
];

const LIBRARY_EXERCISES: readonly Exercise[] = LIBRARY_ROWS.map(([id, name, primary, secondary, equipment, level, compound, motion, prop]) => (
  { id, name, primary, secondary, equipment, level, compound, motion, prop, steps: [], tip: '', library: true }
));

export const EXERCISES: readonly Exercise[] = [...CORE_EXERCISES, ...LIBRARY_EXERCISES];

const BY_ID = new Map(EXERCISES.map((x) => [x.id, x]));

export function getExercise(id: string): Exercise | undefined {
  return BY_ID.get(id);
}

/** Steps and tip; library text lives in its own chunk, fetched the first time it is needed. */
export async function exerciseDetails(ex: Exercise): Promise<ExerciseDetails> {
  if (!ex.library) return ex;
  const { LIBRARY_DETAILS } = await import('./library-details');
  return LIBRARY_DETAILS[ex.id];
}

/** Is the exercise measured in seconds (a hold or an interval) rather than reps? */
export function isTimed(ex: Exercise | undefined): boolean {
  return ex?.timed === true;
}

/** A length of time: "45 s", "1:30", or "1:02:05" from an hour. */
export function durationText(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  if (s < 60) return `${s} s`;
  const pad = (n: number) => String(n).padStart(2, '0');
  const m = Math.floor(s / 60);
  return m < 60 ? `${m}:${pad(s % 60)}` : `${Math.floor(m / 60)}:${pad(m % 60)}:${pad(s % 60)}`;
}

/** A set's amount: "12 reps", or for a timed exercise "45 s" / "1:30". */
export function amountText(ex: Exercise | undefined, n: number): string {
  return isTimed(ex) ? durationText(n) : `${n} ${n === 1 ? 'rep' : 'reps'}`;
}

/** A planned range: "8–12 reps" or "30–45 s". */
export function rangeText(ex: Exercise | undefined, min: number, max: number): string {
  const nums = min === max ? `${min}` : `${min}–${max}`;
  return isTimed(ex) ? `${nums} s` : `${nums} reps`;
}

export function isAvailable(ex: Exercise, equipment: readonly Equipment[]): boolean {
  return ex.equipment.some((eq) => eq === 'bodyweight' || equipment.includes(eq));
}

export interface ExerciseFilter {
  muscle?: MuscleGroup | 'all';
  equipment?: readonly Equipment[];
  query?: string;
}

export function filterExercises(filter: ExerciseFilter, list: readonly Exercise[] = EXERCISES): Exercise[] {
  const q = filter.query?.trim().toLowerCase() ?? '';
  return list.filter((ex) => {
    if (filter.muscle && filter.muscle !== 'all' && ex.primary !== filter.muscle && !ex.secondary.includes(filter.muscle)) {
      return false;
    }
    if (filter.equipment && !isAvailable(ex, filter.equipment)) return false;
    if (q && !ex.name.toLowerCase().includes(q) && !ex.primary.includes(q)) return false;
    return true;
  });
}
