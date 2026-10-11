// Whole-word ASL signs (HELLO, THANK YOU, ...). Unlike letters, these involve
// motion, so the model looks at a short clip instead of a single frame.
//
// A clip is 15 frames resampled evenly across the last 0.8 seconds. Many signs use
// both hands, so each frame has two hand slots, filled by MediaPipe's "Left"/"Right"
// label (neither hand is treated as the main one). Each slot is 45 numbers: the
// handshape (21 landmarks, x and y, centered on that wrist and scaled by palm size),
// where that wrist is compared with the middle of the hands at the start of the clip,
// and 1 if the hand is there (all zeros if it isn't). 15 x 2 x 45 = 1350 per clip.
//
// The z (depth) coordinate is left out so we can reuse the open word dataset
// from github.com/laplaces42/sign-language-interpreter, which only has x and y.
// Older one-hand clips (15 x 44 = 660 numbers) still load: see upgradeClip().
import { toFeatures } from "./hands.js";
import { MLP, KNN } from "./classifier.js";
import { getItem, setItem } from "./store.js";

export const SIGN_FRAMES = 15;
export const SIGN_WINDOW_MS = 800;
export const HAND_SLOTS = ["Left", "Right"]; // MediaPipe's labels, in clip order
export const PER_HAND = 45; // 42 handshape + 2 wrist position + 1 "hand is here"
export const PER_FRAME = PER_HAND * HAND_SLOTS.length;
const OLD_PER_FRAME = 44; // one-hand clips recorded before two-hand support
// One-hand clips (old recordings, letter handshapes) go in this slot. It's where the
// signing hand usually lands: MediaPipe labeled it "Right" in 188 of 228 WLASL videos.
// Training mirrors every clip into the other slot too.
export const ONE_HAND_SLOT = 1;
export const NONE = "NONE"; // "not a word": still hands, fidgeting, letters
const MAX_GAP_MS = 150; // a clip is invalid if the hand vanished for longer than this

// `video` is the clip SignASL.org shows for the sign (signasl.org/sign/<slug>),
// played on a loop on the sign page.
const VIDEO_BASE = "https://media.signbsl.com/videos/asl/";

// The folders the Sign Words section is grouped into (colors are in css/signs.css).
export const SIGN_TOPICS = [
  { id: "greetings", name: "Greetings" },
  { id: "basics", name: "Basics" },
  { id: "questions", name: "Questions" },
  { id: "needs", name: "Food & Needs" },
  { id: "people", name: "People" },
  { id: "feelings", name: "Feelings" },
  { id: "time", name: "Time" },
  { id: "school", name: "School & Deaf Culture" },
  { id: "animals", name: "Animals" },
  { id: "colors", name: "Colors" },
  { id: "actions", name: "Actions & Describing" },
  { id: "home", name: "Home & Things" },
];

// The first five have starter data from the open dataset. The rest appear in
// the game once your team records them in words-recorder.html and retrains.
export const SIGN_WORDS = [
  {
    word: "HELLO", topic: "greetings", emoji: "\u{1F44B}", slug: "hello",
    video: VIDEO_BASE + "startasl/mp4/hello.mp4",
    hint: "Touch the side of your forehead with a flat hand, then move it out and away, like a little salute.",
  },
  {
    word: "THANK YOU", topic: "greetings", emoji: "\u{1F64F}", slug: "thank-you",
    video: VIDEO_BASE + "startasl/mp4/thankyou.mp4",
    hint: "Touch your fingertips to your chin with a flat hand, then move your hand forward and down.",
  },
  {
    word: "PLEASE", topic: "greetings", emoji: "\u{1F97A}", slug: "please",
    video: VIDEO_BASE + "startasl/mp4/please.mp4",
    hint: "Rub a flat hand in a circle on your chest.",
  },
  {
    word: "SORRY", topic: "greetings", emoji: "\u{1F614}", slug: "sorry",
    video: VIDEO_BASE + "startasl/mp4/sorry.mp4",
    hint: "Make a fist (the letter A) and rub it in a circle on your chest.",
  },
  {
    word: "WELCOME", topic: "greetings", emoji: "\u{1F917}", slug: "welcome",
    video: VIDEO_BASE + "aslsignbank/mp4/WELCOME-1476.mp4",
    hint: "Hold a flat hand out to the side, palm up, and sweep it in toward your body.",
  },
  {
    word: "YES", topic: "basics", emoji: "\u{1F44D}", slug: "yes",
    video: VIDEO_BASE + "startasl/mp4/yes.mp4",
    hint: "Make a fist (the letter S) and nod it up and down at the wrist, like a head nodding.",
  },
  {
    word: "NO", topic: "basics", emoji: "\u{1F645}", slug: "no",
    video: VIDEO_BASE + "startasl/mp4/no.mp4",
    hint: "Hold your index and middle fingers out, then snap them closed onto your thumb.",
  },
  {
    word: "EAT", topic: "needs", emoji: "\u{1F34E}", slug: "eat",
    video: VIDEO_BASE + "startasl/mp4/eat.mp4",
    hint: "Bunch your fingertips together onto your thumb and tap them to your mouth twice.",
  },
  {
    word: "I LOVE YOU", topic: "feelings", emoji: "\u{1F91F}", slug: "i-love-you",
    video: VIDEO_BASE + "youtube/mp4/dEUvcuoKxsk.mp4",
    hint: "Stretch out your thumb, index finger, and pinky. Keep the middle two fingers down. Face your palm out.",
  },
  // From WLASL (see data/words/README.md)
  {
    word: "HELP", topic: "basics", emoji: "\u{1F64B}", slug: "help",
    video: VIDEO_BASE + "startasl/mp4/help.mp4",
    hint: "Rest a thumbs-up fist on your other flat palm, then lift both hands up together.",
  },
  {
    word: "NAME", topic: "questions", emoji: "\u{1F4DB}", slug: "name",
    video: null, // no StartASL clip: the sign page shows just the hint
    hint: "Make an H (two fingers out) with both hands and tap one on top of the other twice.",
  },
  {
    word: "DEAF", topic: "people", emoji: "\u{1F9CF}", slug: "deaf",
    video: VIDEO_BASE + "startasl/mp4/deaf.mp4",
    hint: "Touch your index finger near your ear, then near your mouth.",
  },
  {
    word: "UNDERSTAND", topic: "basics", emoji: "\u{1F4A1}", slug: "understand",
    video: null, // no StartASL clip: the sign page shows just the hint
    hint: "Hold a fist near your forehead and flick your index finger up.",
  },
  {
    word: "AGAIN", topic: "basics", emoji: "\u{1F501}", slug: "again",
    video: VIDEO_BASE + "startasl/mp4/again.mp4",
    hint: "Flip a bent hand over and tap its fingertips into the palm of your other hand.",
  },
  {
    word: "WHAT", topic: "questions", emoji: "\u{1F937}", slug: "what",
    video: VIDEO_BASE + "startasl/mp4/what.mp4",
    hint: "Hold both open hands out, palms up, and shake them slightly side to side.",
  },
  {
    word: "WHERE", topic: "questions", emoji: "\u{1F4CD}", slug: "where",
    video: VIDEO_BASE + "startasl/mp4/where.mp4",
    hint: "Hold your index finger up, palm out, and shake it side to side.",
  },
  {
    word: "WANT", topic: "needs", emoji: "\u{1F932}", slug: "want",
    video: VIDEO_BASE + "startasl/mp4/want.mp4",
    hint: "Hold both hands out, palms up, fingers bent like claws, and pull them toward you.",
  },
  {
    word: "NEED", topic: "needs", emoji: "\u{2757}", slug: "need",
    video: VIDEO_BASE + "startasl/mp4/need.mp4",
    hint: "Hook your index finger (the letter X) and bend your wrist down twice.",
  },
  {
    word: "MORE", topic: "basics", emoji: "\u{2795}", slug: "more",
    video: VIDEO_BASE + "startasl/mp4/more.mp4",
    hint: "Bunch the fingertips of both hands onto your thumbs and tap the fingertips together twice.",
  },
  {
    word: "FINISH", topic: "basics", emoji: "\u{2705}", slug: "finish",
    video: VIDEO_BASE + "startasl/mp4/finish.mp4",
    hint: "Hold both open hands up, palms facing you, and flip them outward quickly.",
  },
  {
    word: "BATHROOM", topic: "needs", emoji: "\u{1F6BD}", slug: "bathroom",
    video: VIDEO_BASE + "startasl/mp4/bathroom.mp4",
    hint: "Make the letter T (thumb tucked between your first two fingers) and shake it side to side.",
  },
  {
    word: "WATER", topic: "needs", emoji: "\u{1F4A7}", slug: "water",
    video: VIDEO_BASE + "startasl/mp4/water.mp4",
    hint: "Make a W (three fingers up) and tap your index finger on your chin twice.",
  },
  {
    word: "DRINK", topic: "needs", emoji: "\u{1F964}", slug: "drink",
    video: VIDEO_BASE + "startasl/mp4/drink.mp4",
    hint: "Curve your hand into a C, like holding a cup, and tip it toward your mouth.",
  },
  {
    word: "MOTHER", topic: "people", emoji: "\u{1F469}", slug: "mother",
    video: VIDEO_BASE + "startasl/mp4/mother.mp4",
    hint: "Spread all five fingers and tap your thumb on your chin.",
  },
  {
    word: "FATHER", topic: "people", emoji: "\u{1F468}", slug: "father",
    video: VIDEO_BASE + "startasl/mp4/father.mp4",
    hint: "Spread all five fingers and tap your thumb on your forehead.",
  },
  {
    word: "FAMILY", topic: "people", emoji: "\u{1F46A}", slug: "family",
    video: VIDEO_BASE + "startasl/mp4/family.mp4",
    hint: "Make an F with both hands, touching, and circle them outward until your pinkies meet.",
  },
  {
    word: "FRIEND", topic: "people", emoji: "\u{1F91D}", slug: "friend",
    video: VIDEO_BASE + "startasl/mp4/friend.mp4",
    hint: "Hook your index fingers together, then flip them and hook them the other way.",
  },
  {
    word: "LIKE", topic: "feelings", emoji: "\u{1F44D}", slug: "like",
    video: VIDEO_BASE + "startasl/mp4/like.mp4",
    hint: "Put an open hand on your chest, then pull it away while pinching your thumb and middle finger together.",
  },
  {
    word: "GOOD", topic: "feelings", emoji: "\u{1F60C}", slug: "good",
    video: VIDEO_BASE + "startasl/mp4/good.mp4",
    hint: "Touch the fingertips of a flat hand to your chin, then move it down onto your other palm.",
  },
  {
    word: "WHO", topic: "questions", emoji: "\u{1F9D0}", slug: "who",
    video: VIDEO_BASE + "startasl/mp4/who.mp4",
    hint: "Rest your thumb on your chin and wiggle your bent index finger.",
  },
  // From WLASL, not trained yet (see SIGNS in tools/import_wlasl_words.py)
  {
    word: "GOODBYE", topic: "greetings", emoji: "\u{1F44B}", slug: "goodbye",
    video: VIDEO_BASE + "startasl/mp4/goodbye.mp4",
    hint: "Hold up an open hand, palm out, and fold your fingers down and up a few times, like waving.",
  },
  {
    word: "NICE", topic: "greetings", emoji: "\u{1F60A}", slug: "nice",
    video: VIDEO_BASE + "startasl/mp4/nice.mp4",
    hint: "Slide one flat hand across the palm of your other flat hand, from the heel to the fingertips.",
  },
  {
    word: "MEET", topic: "greetings", emoji: "\u{1F91D}", slug: "meet",
    video: null,
    hint: "Point both index fingers up, palms facing each other, and bring your hands together.",
  },
  {
    word: "FINE", topic: "greetings", emoji: "\u{1F44C}", slug: "fine",
    video: VIDEO_BASE + "startasl/mp4/fine.mp4",
    hint: "Spread all five fingers and tap your thumb on your chest.",
  },
  {
    word: "STOP", topic: "basics", emoji: "\u{270B}", slug: "stop",
    video: null,
    hint: "Chop the side of one flat hand down onto the palm of your other hand.",
  },
  {
    word: "CAN", topic: "basics", emoji: "\u{1F4AA}", slug: "can",
    video: VIDEO_BASE + "startasl/mp4/can.mp4",
    hint: "Hold both fists in front of you and move them down firmly together.",
  },
  {
    word: "WRONG", topic: "basics", emoji: "\u{274C}", slug: "wrong",
    video: VIDEO_BASE + "startasl/mp4/wrong.mp4",
    hint: "Make a Y (thumb and pinky out) and tap the middle of it on your chin.",
  },
  {
    word: "SAME", topic: "basics", emoji: "\u{1F7F0}", slug: "same",
    video: null,
    hint: "Point both index fingers forward and bring them together side by side.",
  },
  {
    word: "DIFFERENT", topic: "basics", emoji: "\u{1F500}", slug: "different",
    video: VIDEO_BASE + "startasl/mp4/different.mp4",
    hint: "Cross your index fingers, then pull your hands apart.",
  },
  {
    word: "ALL", topic: "basics", emoji: "\u{1F310}", slug: "all",
    video: VIDEO_BASE + "startasl/mp4/all.mp4",
    hint: "Circle one flat hand around the other and land it in the other's palm.",
  },
  {
    word: "MANY", topic: "basics", emoji: "\u{1F522}", slug: "many",
    video: VIDEO_BASE + "startasl/mp4/many.mp4",
    hint: "Hold both fists palm up and flick your fingers open, twice.",
  },
  {
    word: "WHEN", topic: "questions", emoji: "\u{1F552}", slug: "when",
    video: VIDEO_BASE + "startasl/mp4/when.mp4",
    hint: "Circle one index finger around your other index finger, then touch the tips together.",
  },
  {
    word: "WHY", topic: "questions", emoji: "\u{2753}", slug: "why",
    video: VIDEO_BASE + "startasl/mp4/why.mp4",
    hint: "Touch your fingertips to your forehead, then pull away into a Y (thumb and pinky out).",
  },
  {
    word: "HOW", topic: "questions", emoji: "\u{1F914}", slug: "how",
    video: VIDEO_BASE + "startasl/mp4/how.mp4",
    hint: "Put the knuckles of both bent hands together, then roll them forward so your palms face up.",
  },
  {
    word: "HUNGRY", topic: "needs", emoji: "\u{1F924}", slug: "hungry",
    video: VIDEO_BASE + "startasl/mp4/hungry.mp4",
    hint: "Curve your hand into a C at the top of your chest and move it down to your stomach.",
  },
  {
    word: "THIRSTY", topic: "needs", emoji: "\u{1F975}", slug: "thirsty",
    video: VIDEO_BASE + "startasl/mp4/thirsty.mp4",
    hint: "Trace your index finger down the front of your throat.",
  },
  {
    word: "SLEEP", topic: "needs", emoji: "\u{1F634}", slug: "sleep",
    video: VIDEO_BASE + "startasl/mp4/sleep.mp4",
    hint: "Hold an open hand in front of your face and draw it down, closing your fingers together at your chin.",
  },
  {
    word: "MILK", topic: "needs", emoji: "\u{1F95B}", slug: "milk",
    video: VIDEO_BASE + "startasl/mp4/milk.mp4",
    hint: "Squeeze a fist open and closed, like milking a cow.",
  },
  {
    word: "APPLE", topic: "needs", emoji: "\u{1F34E}", slug: "apple",
    video: VIDEO_BASE + "startasl/mp4/apple.mp4",
    hint: "Press the knuckle of your bent index finger into your cheek and twist it.",
  },
  {
    word: "COOKIE", topic: "needs", emoji: "\u{1F36A}", slug: "cookie",
    video: VIDEO_BASE + "startasl/mp4/cookie.mp4",
    hint: "Twist the fingertips of a claw hand on your other palm, like a cookie cutter.",
  },
  {
    word: "CANDY", topic: "needs", emoji: "\u{1F36C}", slug: "candy",
    video: VIDEO_BASE + "startasl/mp4/candy.mp4",
    hint: "Touch your index finger to your cheek and twist it.",
  },
  {
    word: "PIZZA", topic: "needs", emoji: "\u{1F355}", slug: "pizza",
    video: VIDEO_BASE + "startasl/mp4/pizza.mp4",
    hint: "Bend your index and middle fingers (a bent V) and draw a Z in the air.",
  },
  {
    word: "TALK", topic: "actions", emoji: "\u{1F5E3}\u{FE0F}", slug: "talk",
    video: null,
    hint: "Hold your index finger at your mouth and move it forward and back a few times.",
  },
  {
    word: "BROTHER", topic: "people", emoji: "\u{1F466}", slug: "brother",
    video: VIDEO_BASE + "startasl/mp4/brother.mp4",
    hint: "Make an L at your forehead, then bring it down to rest on an L made by your other hand.",
  },
  {
    word: "SISTER", topic: "people", emoji: "\u{1F467}", slug: "sister",
    video: VIDEO_BASE + "startasl/mp4/sister.mp4",
    hint: "Make an L at your jaw, then bring it down to rest on an L made by your other hand.",
  },
  {
    word: "BABY", topic: "people", emoji: "\u{1F476}", slug: "baby",
    video: VIDEO_BASE + "startasl/mp4/baby.mp4",
    hint: "Cradle your arms, one resting on the other, and rock them side to side.",
  },
  {
    word: "TEACHER", topic: "people", emoji: "\u{1F9D1}\u{200D}\u{1F3EB}", slug: "teacher",
    video: VIDEO_BASE + "startasl/mp4/teacher.mp4",
    hint: "Bunch your fingertips near your forehead and push forward twice, then slide flat hands down your sides.",
  },
  {
    word: "STUDENT", topic: "people", emoji: "\u{1F9D1}\u{200D}\u{1F393}", slug: "student",
    video: VIDEO_BASE + "startasl/mp4/student.mp4",
    hint: "Grab from your open palm up to your forehead, then slide flat hands down your sides.",
  },
  {
    word: "DOCTOR", topic: "people", emoji: "\u{1F9D1}\u{200D}\u{2695}\u{FE0F}", slug: "doctor",
    video: VIDEO_BASE + "startasl/mp4/doctor.mp4",
    hint: "Tap your fingertips on the inside of your other wrist, where you'd check a pulse.",
  },
  {
    word: "BOY", topic: "people", emoji: "\u{1F466}", slug: "boy",
    video: VIDEO_BASE + "startasl/mp4/boy.mp4",
    hint: "At your forehead, open and close your fingers against your thumb, like gripping a cap's brim.",
  },
  {
    word: "GIRL", topic: "people", emoji: "\u{1F467}", slug: "girl",
    video: VIDEO_BASE + "startasl/mp4/girl.mp4",
    hint: "Make a fist and stroke your thumb down along your jaw.",
  },
  {
    word: "MAN", topic: "people", emoji: "\u{1F468}", slug: "man",
    video: VIDEO_BASE + "startasl/mp4/man.mp4",
    hint: "Spread all five fingers, touch your thumb to your forehead, then to your chest.",
  },
  {
    word: "WOMAN", topic: "people", emoji: "\u{1F469}", slug: "woman",
    video: VIDEO_BASE + "startasl/mp4/woman.mp4",
    hint: "Spread all five fingers, touch your thumb to your chin, then to your chest.",
  },
  {
    word: "LOVE", topic: "feelings", emoji: "\u{2764}\u{FE0F}", slug: "love",
    video: VIDEO_BASE + "startasl/mp4/love.mp4",
    hint: "Cross both fists over your chest, like giving yourself a hug.",
  },
  {
    word: "HAPPY", topic: "feelings", emoji: "\u{1F604}", slug: "happy",
    video: VIDEO_BASE + "startasl/mp4/happy.mp4",
    hint: "Brush a flat hand up your chest in small circles, twice.",
  },
  {
    word: "SAD", topic: "feelings", emoji: "\u{1F622}", slug: "sad",
    video: VIDEO_BASE + "startasl/mp4/sad.mp4",
    hint: "Hold both open hands in front of your face, palms in, and slowly move them down.",
  },
  {
    word: "TIRED", topic: "feelings", emoji: "\u{1F62B}", slug: "tired",
    video: VIDEO_BASE + "startasl/mp4/tired.mp4",
    hint: "Put the fingertips of both bent hands on your chest, then let them droop down.",
  },
  {
    word: "SICK", topic: "feelings", emoji: "\u{1F912}", slug: "sick",
    video: VIDEO_BASE + "startasl/mp4/sick.mp4",
    hint: "Touch one middle finger to your forehead and the other to your stomach.",
  },
  {
    word: "HURT", topic: "feelings", emoji: "\u{1F915}", slug: "hurt",
    video: VIDEO_BASE + "startasl/mp4/hurt.mp4",
    hint: "Point both index fingers at each other and twist them, in front of where it hurts.",
  },
  {
    word: "BAD", topic: "feelings", emoji: "\u{1F44E}", slug: "bad",
    video: VIDEO_BASE + "startasl/mp4/bad.mp4",
    hint: "Touch the fingertips of a flat hand to your chin, then flip it down so your palm faces the floor.",
  },
  {
    word: "ANGRY", topic: "feelings", emoji: "\u{1F620}", slug: "angry",
    video: VIDEO_BASE + "startasl/mp4/angry.mp4",
    hint: "Hold a claw hand in front of your face and pull it out and up, tensing your fingers.",
  },
  {
    word: "SCARED", topic: "feelings", emoji: "\u{1F628}", slug: "scared",
    video: VIDEO_BASE + "startasl/mp4/scared.mp4",
    hint: "Hold both fists at the sides of your chest, then open them quickly toward the middle, fingers spread.",
  },
  {
    word: "CRY", topic: "feelings", emoji: "\u{1F62D}", slug: "cry",
    video: VIDEO_BASE + "startasl/mp4/cry.mp4",
    hint: "Trace both index fingers down your cheeks, like tears.",
  },
  {
    word: "LAUGH", topic: "feelings", emoji: "\u{1F602}", slug: "laugh",
    video: null,
    hint: "Brush both index fingers up from the corners of your mouth toward your ears, twice.",
  },
  {
    word: "FEEL", topic: "feelings", emoji: "\u{1FAF6}", slug: "feel",
    video: null,
    hint: "Brush your middle finger up your chest.",
  },
  {
    word: "NOW", topic: "time", emoji: "\u{23F0}", slug: "now",
    video: VIDEO_BASE + "startasl/mp4/now.mp4",
    hint: "Hold both bent hands out, palms up, and drop them down a little.",
  },
  {
    word: "LATER", topic: "time", emoji: "\u{23ED}\u{FE0F}", slug: "later",
    video: null,
    hint: "Make an L, rest your thumb on your other palm, and tip your index finger forward.",
  },
  {
    word: "TODAY", topic: "time", emoji: "\u{1F4C5}", slug: "today",
    video: VIDEO_BASE + "startasl/mp4/today.mp4",
    hint: "Sign NOW (palms-up hands drop slightly), then DAY (an index-finger arm sweeps down onto your other arm).",
  },
  {
    word: "TOMORROW", topic: "time", emoji: "\u{1F51C}", slug: "tomorrow",
    video: VIDEO_BASE + "startasl/mp4/tomorrow.mp4",
    hint: "Put your thumb on your cheek with your fingers in a fist, then move it forward.",
  },
  {
    word: "YESTERDAY", topic: "time", emoji: "\u{1F519}", slug: "yesterday",
    video: VIDEO_BASE + "startasl/mp4/yesterday.mp4",
    hint: "Put your thumb on your cheek near your chin, then move it back toward your ear.",
  },
  {
    word: "MORNING", topic: "time", emoji: "\u{1F305}", slug: "morning",
    video: VIDEO_BASE + "startasl/mp4/morning.mp4",
    hint: "With your other arm across your body, raise a palm-up flat hand from the crook of that elbow, like a rising sun.",
  },
  {
    word: "NIGHT", topic: "time", emoji: "\u{1F319}", slug: "night",
    video: null,
    hint: "Tap a bent hand over the back of your other wrist, like the sun setting.",
  },
  {
    word: "DAY", topic: "time", emoji: "\u{2600}\u{FE0F}", slug: "day",
    video: VIDEO_BASE + "startasl/mp4/day.mp4",
    hint: "Point your index finger up, elbow on your other hand, and sweep the arm down across your body.",
  },
  {
    word: "WEEK", topic: "time", emoji: "\u{1F5D3}\u{FE0F}", slug: "week",
    video: VIDEO_BASE + "startasl/mp4/week.mp4",
    hint: "Slide your index finger across the palm of your other flat hand.",
  },
  {
    word: "TIME", topic: "time", emoji: "\u{231A}", slug: "time",
    video: VIDEO_BASE + "startasl/mp4/time.mp4",
    hint: "Tap your index finger on the back of your other wrist, where a watch would be.",
  },
  {
    word: "YEAR", topic: "time", emoji: "\u{1F389}", slug: "year",
    video: VIDEO_BASE + "startasl/mp4/year.mp4",
    hint: "Circle one fist around the other and land it on top.",
  },
  {
    word: "HEARING", topic: "school", emoji: "\u{1F442}", slug: "hearing",
    video: VIDEO_BASE + "startasl/mp4/hearing.mp4",
    hint: "Roll your index finger forward in small circles in front of your mouth.",
  },
  {
    word: "SIGN", topic: "school", emoji: "\u{1F450}", slug: "sign",
    video: VIDEO_BASE + "startasl/mp4/sign.mp4",
    hint: "Point both index fingers and circle them, one after the other, in front of you.",
  },
  {
    word: "LEARN", topic: "school", emoji: "\u{1F9E0}", slug: "learn",
    video: VIDEO_BASE + "startasl/mp4/learn.mp4",
    hint: "Grab from the palm of your other hand and bring your bunched fingertips to your forehead.",
  },
  {
    word: "KNOW", topic: "school", emoji: "\u{1F4A1}", slug: "know",
    video: VIDEO_BASE + "startasl/mp4/know.mp4",
    hint: "Tap the fingertips of a flat hand on your forehead.",
  },
  {
    word: "THINK", topic: "school", emoji: "\u{1F4AD}", slug: "think",
    video: null,
    hint: "Tap your index finger on your forehead.",
  },
  {
    word: "SCHOOL", topic: "school", emoji: "\u{1F3EB}", slug: "school",
    video: VIDEO_BASE + "startasl/mp4/school.mp4",
    hint: "Clap one flat hand down onto the other palm, twice.",
  },
  {
    word: "WORK", topic: "school", emoji: "\u{1F4BC}", slug: "work",
    video: VIDEO_BASE + "startasl/mp4/work.mp4",
    hint: "Tap one fist on the back of the wrist of your other fist, twice.",
  },
  {
    word: "BOOK", topic: "school", emoji: "\u{1F4D6}", slug: "book",
    video: VIDEO_BASE + "startasl/mp4/book.mp4",
    hint: "Press your palms together, then open them like a book.",
  },
  {
    word: "STUDY", topic: "school", emoji: "\u{1F4DA}", slug: "study",
    video: VIDEO_BASE + "startasl/mp4/study.mp4",
    hint: "Wiggle the fingers of one hand toward the upturned palm of your other hand.",
  },
  {
    word: "LANGUAGE", topic: "school", emoji: "\u{1F4AC}", slug: "language",
    video: null,
    hint: "Touch the thumbs of two L hands together, then pull them apart with a little wiggle.",
  },
  {
    word: "READ", topic: "school", emoji: "\u{1F453}", slug: "read",
    video: VIDEO_BASE + "startasl/mp4/read.mp4",
    hint: "Point two fingers (a V) at your other palm and move them down it, like eyes scanning a page.",
  },
  {
    word: "WRITE", topic: "school", emoji: "\u{270F}\u{FE0F}", slug: "write",
    video: VIDEO_BASE + "startasl/mp4/write.mp4",
    hint: "Pinch your thumb and index finger like holding a pen and draw a line across your other palm.",
  },
  {
    word: "COMPUTER", topic: "school", emoji: "\u{1F4BB}", slug: "computer",
    video: VIDEO_BASE + "startasl/mp4/computer.mp4",
    hint: "Make a C and move it up along the back of your other forearm.",
  },
  {
    word: "DOG", topic: "animals", emoji: "\u{1F436}", slug: "dog",
    video: VIDEO_BASE + "startasl/mp4/dog.mp4",
    hint: "Pat your thigh, then snap your fingers, like calling a dog.",
  },
  {
    word: "CAT", topic: "animals", emoji: "\u{1F431}", slug: "cat",
    video: VIDEO_BASE + "startasl/mp4/cat.mp4",
    hint: "Pinch your thumb and index finger near your cheek and pull outward, like whiskers.",
  },
  {
    word: "BIRD", topic: "animals", emoji: "\u{1F426}", slug: "bird",
    video: VIDEO_BASE + "startasl/mp4/bird.mp4",
    hint: "At your mouth, open and close your thumb and index finger like a beak.",
  },
  {
    word: "FISH", topic: "animals", emoji: "\u{1F41F}", slug: "fish",
    video: VIDEO_BASE + "startasl/mp4/fish.mp4",
    hint: "Wiggle a flat hand forward like a swimming fish, with your other hand touching its wrist.",
  },
  {
    word: "COW", topic: "animals", emoji: "\u{1F42E}", slug: "cow",
    video: VIDEO_BASE + "startasl/mp4/cow.mp4",
    hint: "Make a Y (thumb and pinky out), put your thumb at your temple, and twist it, like a horn.",
  },
  {
    word: "COLOR", topic: "colors", emoji: "\u{1F3A8}", slug: "color",
    video: VIDEO_BASE + "startasl/mp4/color.mp4",
    hint: "Wiggle the fingers of an open hand in front of your chin.",
  },
  {
    word: "RED", topic: "colors", emoji: "\u{1F534}", slug: "red",
    video: VIDEO_BASE + "startasl/mp4/red.mp4",
    hint: "Brush your index finger down across your lips.",
  },
  {
    word: "BLUE", topic: "colors", emoji: "\u{1F535}", slug: "blue",
    video: VIDEO_BASE + "startasl/mp4/blue.mp4",
    hint: "Make a B (flat hand, thumb tucked) and twist it back and forth.",
  },
  {
    word: "GREEN", topic: "colors", emoji: "\u{1F7E2}", slug: "green",
    video: VIDEO_BASE + "startasl/mp4/green.mp4",
    hint: "Make a G and twist it back and forth.",
  },
  {
    word: "YELLOW", topic: "colors", emoji: "\u{1F7E1}", slug: "yellow",
    video: VIDEO_BASE + "startasl/mp4/yellow.mp4",
    hint: "Make a Y (thumb and pinky out) and twist it back and forth.",
  },
  {
    word: "BLACK", topic: "colors", emoji: "\u{26AB}", slug: "black",
    video: VIDEO_BASE + "startasl/mp4/black.mp4",
    hint: "Slide your index finger across your forehead.",
  },
  {
    word: "WHITE", topic: "colors", emoji: "\u{26AA}", slug: "white",
    video: VIDEO_BASE + "startasl/mp4/white.mp4",
    hint: "Put an open hand on your chest and pull it away, closing your fingertips together.",
  },
  {
    word: "ORANGE", topic: "colors", emoji: "\u{1F7E0}", slug: "orange",
    video: VIDEO_BASE + "startasl/mp4/orange.mp4",
    hint: "Squeeze a fist open and closed in front of your chin.",
  },
  {
    word: "PINK", topic: "colors", emoji: "\u{1F338}", slug: "pink",
    video: VIDEO_BASE + "startasl/mp4/pink.mp4",
    hint: "Make a P and brush your middle finger down across your lips.",
  },
  {
    word: "GO", topic: "actions", emoji: "\u{1F3C3}", slug: "go",
    video: VIDEO_BASE + "startasl/mp4/go.mp4",
    hint: "Point both index fingers and swing them forward, away from you.",
  },
  {
    word: "PLAY", topic: "actions", emoji: "\u{26BD}", slug: "play",
    video: VIDEO_BASE + "startasl/mp4/play.mp4",
    hint: "Make a Y with both hands and shake them at the wrists.",
  },
  {
    word: "WALK", topic: "actions", emoji: "\u{1F6B6}", slug: "walk",
    video: VIDEO_BASE + "startasl/mp4/walk.mp4",
    hint: "Hold both flat hands palm down and move them forward one after the other, like feet.",
  },
  {
    word: "DANCE", topic: "actions", emoji: "\u{1F483}", slug: "dance",
    video: VIDEO_BASE + "startasl/mp4/dance.mp4",
    hint: "Swing two fingers (a V) back and forth over your other upturned palm, like legs dancing.",
  },
  {
    word: "TELL", topic: "actions", emoji: "\u{1F4E2}", slug: "tell",
    video: null,
    hint: "Touch your index finger to your chin, then move it out toward the person.",
  },
  {
    word: "HOT", topic: "actions", emoji: "\u{1F525}", slug: "hot",
    video: VIDEO_BASE + "startasl/mp4/hot.mp4",
    hint: "Hold a claw hand at your mouth, then twist it away quickly.",
  },
  {
    word: "COLD", topic: "actions", emoji: "\u{1F976}", slug: "cold",
    video: VIDEO_BASE + "startasl/mp4/cold.mp4",
    hint: "Hold both fists in front of you and shake them, like shivering.",
  },
  {
    word: "BIG", topic: "actions", emoji: "\u{1F418}", slug: "big",
    video: null,
    hint: "Hold both hands in an L shape in front of you and pull them apart.",
  },
  {
    word: "SMALL", topic: "actions", emoji: "\u{1F42D}", slug: "small",
    video: VIDEO_BASE + "startasl/mp4/small.mp4",
    hint: "Hold two flat hands facing each other and move them closer together.",
  },
  {
    word: "TALL", topic: "actions", emoji: "\u{1F992}", slug: "tall",
    video: VIDEO_BASE + "startasl/mp4/tall.mp4",
    hint: "Slide your index finger up the palm of your other flat hand.",
  },
  {
    word: "HOME", topic: "home", emoji: "\u{1F3E0}", slug: "home",
    video: VIDEO_BASE + "startasl/mp4/home.mp4",
    hint: "Touch your bunched fingertips to your cheek near your mouth, then near your ear.",
  },
  {
    word: "HOUSE", topic: "home", emoji: "\u{1F3E1}", slug: "house",
    video: VIDEO_BASE + "startasl/mp4/house.mp4",
    hint: "Make a roof with two flat hands touching at the fingertips, then move them down and apart for the walls.",
  },
  {
    word: "BED", topic: "home", emoji: "\u{1F6CF}\u{FE0F}", slug: "bed",
    video: VIDEO_BASE + "startasl/mp4/bed.mp4",
    hint: "Tilt your head and rest your cheek on a flat hand, like a pillow.",
  },
  {
    word: "CHAIR", topic: "home", emoji: "\u{1FA91}", slug: "chair",
    video: VIDEO_BASE + "startasl/mp4/chair.mp4",
    hint: "Tap two bent fingers twice onto two fingers of your other hand, like legs on a seat.",
  },
  {
    word: "TABLE", topic: "home", emoji: "\u{1F37D}\u{FE0F}", slug: "table",
    video: VIDEO_BASE + "startasl/mp4/table.mp4",
    hint: "Lay one forearm on top of the other in front of you and pat it down twice.",
  },
  {
    word: "CLOTHES", topic: "home", emoji: "\u{1F455}", slug: "clothes",
    video: VIDEO_BASE + "startasl/mp4/clothes.mp4",
    hint: "Brush both open hands down your chest, twice.",
  },
  {
    word: "CAR", topic: "home", emoji: "\u{1F697}", slug: "car",
    video: VIDEO_BASE + "startasl/mp4/car.mp4",
    hint: "Hold an imaginary steering wheel with both hands and turn it.",
  },
];

export const signRewards = (done) => (done ? 5 : 20);

// ---------- features ----------

// One hand -> handshape (42 numbers) plus wrist position and palm size.
function handInfo(lm, aspect, leftHanded) {
  const shape = toFeatures(lm, aspect, leftHanded).filter((_, i) => i % 3 !== 2); // drop z
  const flip = leftHanded ? -1 : 1;
  const size = Math.hypot((lm[9].x - lm[0].x) * aspect, lm[9].y - lm[0].y) || 1;
  return { shape, wx: flip * lm[0].x * aspect, wy: lm[0].y, size };
}

// The hands in one video frame ([{ lm, label }]) -> one entry per slot (null if empty).
// Left-handed signers are mirrored, which also swaps which slot each hand goes in.
export function frameHands(hands, aspect, leftHanded) {
  const slots = HAND_SLOTS.map(() => null);
  for (const { lm, label } of hands) {
    let i = HAND_SLOTS.indexOf(label);
    if (i < 0) i = ONE_HAND_SLOT;
    if (leftHanded) i = HAND_SLOTS.length - 1 - i;
    if (!slots[i]) slots[i] = handInfo(lm, aspect, leftHanded);
  }
  return slots;
}

// SIGN_FRAMES frames (each a list of slots) -> one clip of SIGN_FRAMES * PER_FRAME numbers.
export function clipFeatures(frames) {
  const present = frames.flatMap((slots) => slots.filter(Boolean));
  const size = present.reduce((a, h) => a + h.size, 0) / present.length;
  // Wrist positions are measured from the middle of the hands in the first frame.
  const first = frames[0].filter(Boolean);
  const ox = first.reduce((a, h) => a + h.wx, 0) / first.length;
  const oy = first.reduce((a, h) => a + h.wy, 0) / first.length;
  const out = [];
  for (const slots of frames) {
    for (const h of slots) {
      if (h) out.push(...h.shape, (h.wx - ox) / size, (h.wy - oy) / size, 1);
      else for (let i = 0; i < PER_HAND; i++) out.push(0);
    }
  }
  return out;
}

// An old one-hand clip (660 numbers) -> the two-hand format, other hand marked missing.
export function upgradeClip(f) {
  if (f.length === SIGN_FRAMES * PER_FRAME) return f;
  if (f.length !== SIGN_FRAMES * OLD_PER_FRAME) return null;
  const out = [];
  for (let k = 0; k < SIGN_FRAMES; k++) {
    const hand = [...f.slice(k * OLD_PER_FRAME, (k + 1) * OLD_PER_FRAME), 1];
    const empty = new Array(PER_HAND).fill(0);
    out.push(...(ONE_HAND_SLOT === 0 ? [...hand, ...empty] : [...empty, ...hand]));
  }
  return out;
}

// Resample timed frames ({ t, slots }, sorted by t) between start and end.
// Returns null if no hand was in view for part of that stretch.
export function clipAt(frames, start, end) {
  const picked = [];
  let j = 0;
  for (let i = 0; i < SIGN_FRAMES; i++) {
    const t = start + ((end - start) * i) / (SIGN_FRAMES - 1);
    while (j + 1 < frames.length && Math.abs(frames[j + 1].t - t) <= Math.abs(frames[j].t - t)) j++;
    if (!frames[j] || Math.abs(frames[j].t - t) > MAX_GAP_MS) return null;
    picked.push(frames[j].slots);
  }
  return clipFeatures(picked);
}

// Cut a recorded take into overlapping clips (one training sample each).
export function sliceTake(frames, strideMs = 300) {
  const clips = [];
  if (!frames.length) return clips;
  const first = frames[0].t;
  const last = frames[frames.length - 1].t;
  for (let end = first + SIGN_WINDOW_MS; end <= last; end += strideMs) {
    const clip = clipAt(frames, end - SIGN_WINDOW_MS, end);
    if (clip) clips.push(clip);
  }
  return clips;
}

// Rolling buffer of recent frames for live recognition.
export class SignBuffer {
  constructor() {
    this.frames = [];
  }

  // hands: [{ lm, label }] for this frame (frames with no hands are skipped).
  push(t, hands, aspect, leftHanded) {
    if (!hands.length) return;
    this.frames.push({ t, slots: frameHands(hands, aspect, leftHanded) });
    while (this.frames.length && this.frames[0].t < t - SIGN_WINDOW_MS - 300) this.frames.shift();
  }

  clear() {
    this.frames = [];
  }

  clip(now) {
    return clipAt(this.frames, now - SIGN_WINDOW_MS, now);
  }
}

// ---------- storage + model ----------

// Clips saved in this browser; older one-hand clips are upgraded as they load.
export const loadWordSamples = () =>
  getItem("sls_word_samples", []).map((s) => ({ ...s, f: upgradeClip(s.f) })).filter((s) => s.f);
export const saveWordSamples = (s) => setItem("sls_word_samples", s);

// MLP from model/words.json (trained by train_words.py), or kNN on clips
// recorded in this browser as a quick start.
export async function loadSignClassifier() {
  try {
    const res = await fetch("model/words.json", { cache: "no-store" });
    if (res.ok) {
      const json = await res.json();
      // A model trained before two-hand clips expects the old size: skip it.
      if (json.layers && json.per_frame === PER_FRAME) return new MLP(json);
      if (json.layers) console.warn("model/words.json is the old one-hand format. Run train_words.py again.");
    }
  } catch {
    // no trained word model yet
  }
  const samples = loadWordSamples();
  if (samples.length >= 20) return new KNN(samples, 5);
  return null;
}
