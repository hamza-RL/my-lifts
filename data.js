export const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const M = { ch: 'chest', sh: 'shoulders', tr: 'triceps', bi: 'biceps', fo: 'forearms', la: 'lats', ub: 'upper back', tp: 'traps',
  lb: 'lower back', ab: 'abs', ob: 'obliques', qu: 'quads', ha: 'hamstrings', gl: 'glutes', cv: 'calves', ad: 'adductors',
  aa: 'abductors', cd: 'cardio' };
const E = { B: 'Barbell', D: 'Dumbbell', M: 'Machine', C: 'Cable', W: 'Bodyweight', S: 'Smith machine', O: 'Other', K: 'Cardio machine' };
export const MUSCLES = Object.values(M);
export const EQUIP = Object.values(E);
export const TYPES = { wr: 'Weight + reps', br: 'Bodyweight reps', wb: 'Weighted bodyweight', ab: 'Assisted bodyweight',
  ro: 'Reps only', du: 'Duration', dd: 'Distance + duration' };

// name|equipment|primary|secondary|type (default type: weight + reps)
const RAW = `Bench Press (Barbell)|B|ch|tr,sh
Incline Bench Press (Barbell)|B|ch|sh,tr
Decline Bench Press (Barbell)|B|ch|tr
Dumbbell Bench Press|D|ch|tr,sh
Incline Dumbbell Bench Press|D|ch|sh,tr
30° Incline Dumbbell Press|D|ch|sh,tr
Decline Dumbbell Press|D|ch|tr
Smith Machine Bench Press|S|ch|tr,sh
Smith Machine Incline Press|S|ch|sh,tr
Seated Chest Press Machine|M|ch|tr,sh
Incline Chest Press Machine|M|ch|sh,tr
Pec Deck Fly|M|ch|sh
Dumbbell Fly|D|ch|sh
Incline Dumbbell Fly|D|ch|sh
Cable Crossover|C|ch|sh
Low-to-High Cable Fly|C|ch|sh
Push-Up|W|ch|tr,sh|br
Incline Push-Up|W|ch|tr,sh|br
Decline Push-Up|W|ch|tr,sh|br
Dips|W|tr|ch,sh|wb
Assisted Dips|M|tr|ch,sh|ab
Overhead Press (Barbell)|B|sh|tr
Seated Dumbbell Shoulder Press|D|sh|tr
Overhead Shoulder Press Machine|M|sh|tr
Arnold Press|D|sh|tr
Smith Machine Shoulder Press|S|sh|tr
Landmine Press|B|sh|ch,tr
Lateral Raise (Dumbbell)|D|sh
Lateral Raise Machine|M|sh
Cable Lateral Raise|C|sh
Front Raise (Dumbbell)|D|sh
Cable Front Raise|C|sh
Reverse Pec Deck Fly|M|sh|ub
Rear Delt Fly (Dumbbell)|D|sh|ub
Face Pull|C|sh|ub
Upright Row (Barbell)|B|sh|tp
Cable Upright Row|C|sh|tp
Barbell Shrug|B|tp
Dumbbell Shrug|D|tp
Machine Shrug|M|tp
Cable Triceps Pushdown|C|tr
Rope Triceps Pushdown|C|tr
Overhead Cable Triceps Extension|C|tr
Skull Crusher (Barbell)|B|tr
Dumbbell Triceps Extension|D|tr
Close-Grip Bench Press|B|tr|ch,sh
Triceps Dip Machine|M|tr
Bench Dips|W|tr|sh|br
Triceps Kickback|D|tr
Barbell Curl|B|bi|fo
EZ-Bar Curl|B|bi|fo
Dumbbell Curl|D|bi|fo
Dumbbell Hammer Curls|D|bi|fo
Incline Dumbbell Curl|D|bi
Machine Biceps Curl|M|bi
Preacher Curl (EZ-Bar)|B|bi
Cable Curl|C|bi|fo
Concentration Curl|D|bi
Spider Curl|D|bi
Zottman Curl|D|bi|fo
DB Reverse Curls|D|fo|bi
DB Wrist Curls|D|fo
Reverse Wrist Curl|D|fo
Barbell Wrist Curl|B|fo
Dead Hang|W|fo|la|du
Farmer's Walk|D|fo|tp|du
Lat Pulldown|C|la|bi,ub
Wide-Grip Lat Pulldown|C|la|bi,ub
Close-Grip Lat Pulldown (V-bar)|C|la|bi
Straight-Arm Cable Pulldown|C|la|tr
Seated Cable Row|C|ub|la,bi
Single-Arm Cable Row|C|la|ub,bi
Chest-Supported Machine Row|M|ub|la,bi
Machine Row|M|ub|la,bi
Bent-Over Row (Barbell)|B|ub|la,bi,lb
Pendlay Row|B|ub|la,lb
One-Arm Dumbbell Row|D|la|ub,bi
T-Bar Row|B|ub|la,bi
Inverted Row|W|ub|la,bi|br
Pull-Up|W|la|bi,ub|br
Chin-Up|W|la|bi|br
Assisted Pull-Up|M|la|bi,ub|ab
Weighted Pull-Up|W|la|bi,ub|wb
Dumbbell Pullover|D|la|ch
Deadlift (Barbell)|B|lb|gl,ha,tp
Sumo Deadlift|B|gl|ha,qu,lb
Trap Bar Deadlift|B|qu|gl,ha,lb
Romanian Deadlift (Barbell)|B|ha|gl,lb
Dumbbell Romanian Deadlift|D|ha|gl,lb
Rack Pull|B|tp|lb,gl
45° Back Extensions|W|lb|gl,ha|wb
Hyperextension Machine|M|lb|gl
Good Morning|B|lb|ha,gl
Squat (Barbell)|B|qu|gl,ha,lb
Front Squat (Barbell)|B|qu|gl
Smith Machine Squat|S|qu|gl
Goblet Squat|D|qu|gl
Hack Squat Machine|M|qu|gl
Leg Press|M|qu|gl,ha
Leg Extensions|M|qu
Seated Leg Curl|M|ha
Lying Leg Curl|M|ha
Standing Leg Curl|M|ha
Bulgarian Split Squat|D|qu|gl
Walking Lunge (Dumbbell)|D|qu|gl,ha
Reverse Lunge|D|qu|gl
Step-Up|D|qu|gl
Hip Thrust (Barbell)|B|gl|ha
Hip Thrust Machine|M|gl|ha
Glute Bridge|W|gl|ha|br
Cable Pull-Through|C|gl|ha
Cable Kickback|C|gl
Kettlebell Swing|O|gl|ha,lb
Hip Abductor Machine|M|aa|gl
Hip Adductor Machine|M|ad
Nordic Hamstring Curl|W|ha|gl|br
Wall Sit|W|qu||du
Calf Raises (machine/press)|M|cv
Standing Calf Raises|M|cv
Seated Calf Raise|M|cv
Smith Machine Calf Raise|S|cv
Single-Leg Calf Raise|W|cv||br
Machine Ab Crunch|M|ab
Cable Crunch|C|ab
Hanging Knee Raises|W|ab|ob|br
Hanging Leg Raise|W|ab|ob|br
Crunch|W|ab||ro
Decline Crunch|W|ab||ro
Sit-Up|W|ab||ro
Bicycle Crunch|W|ab|ob|ro
Lying Leg Raise|W|ab||ro
Dead Bug|W|ab||ro
Russian Twist|O|ob|ab|ro
Cable Woodchop|C|ob|ab
Cable Pallof Press|C|ob|ab
Plank|W|ab|ob,lb|du
Side Plank|W|ob|ab|du
Ab Wheel Rollout|O|ab|sh|ro
Stepper / Stair Climber|K|cd||du
Treadmill|K|cd||dd
Incline Walk (Treadmill)|K|cd||dd
Stationary Bike|K|cd||dd
Elliptical|K|cd||dd
Rowing Machine|K|cd|la,qu|dd
Running (Outdoor)|K|cd||dd
Walking|K|cd||dd
Cycling (Outdoor)|K|cd||dd
Swimming|O|cd||dd
Jump Rope|O|cd||du
Battle Ropes|O|cd|sh|du`;

export const SEED = RAW.split('\n').map(l => {
  const [name, e, p, s, t] = l.split('|');
  return { id: slug(name), name, equipment: E[e], primary: M[p], secondary: s ? s.split(',').map(x => M[x]) : [], type: t || 'wr', builtin: true };
});

// [exercise name, sets, repsMin, repsMax, optional note]
export const SEED_ROUTINES = [
  ['Push A', [['30° Incline Dumbbell Press', 3, 8, 10], ['Seated Chest Press Machine', 3, 8, 10], ['Lateral Raise Machine', 4, 12, 15],
    ['Pec Deck Fly', 2, 12, 15], ['Overhead Cable Triceps Extension', 3, 12, 15], ['Machine Ab Crunch', 2, 12, 15]]],
  ['Pull A', [['Lat Pulldown', 4, 8, 10], ['Seated Cable Row', 3, 8, 10], ['Straight-Arm Cable Pulldown', 2, 12, 15],
    ['Reverse Pec Deck Fly', 3, 12, 15], ['Machine Biceps Curl', 3, 12, 15], ['DB Wrist Curls', 2, 15, 20]]],
  ['Legs A', [['Hip Abductor Machine', 2, 15, 20], ['Leg Press', 4, 8, 10], ['Leg Extensions', 3, 12, 15],
    ['Seated Leg Curl', 3, 12, 15], ['Calf Raises (machine/press)', 3, 12, 15]]],
  ['Push B', [['Overhead Shoulder Press Machine', 3, 8, 10], ['30° Incline Dumbbell Press', 3, 8, 10], ['Lateral Raise Machine', 4, 12, 15],
    ['Seated Chest Press Machine', 2, 8, 10], ['Cable Triceps Pushdown', 3, 12, 15], ['Machine Ab Crunch', 2, 12, 15]]],
  ['Pull B', [['Close-Grip Lat Pulldown (V-bar)', 3, 8, 10], ['Chest-Supported Machine Row', 3, 8, 10], ['Reverse Pec Deck Fly', 3, 12, 15],
    ['Dumbbell Hammer Curls', 3, 10, 12], ['Hanging Knee Raises', 2, 8, 12], ['DB Reverse Curls', 2, 12, 15]]],
  ['Legs B', [['Hip Abductor Machine', 2, 15, 20], ['Leg Press', 3, 8, 10, 'Feet high'], ['45° Back Extensions', 3, 10, 15],
    ['Seated Leg Curl', 3, 12, 15], ['Standing Calf Raises', 3, 12, 15]]]
];
