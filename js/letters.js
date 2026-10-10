// Static fingerspelling letters. J and Z need motion, so they're left out of the MVP.
export const LETTERS = "ABCDEFGHIKLMNOPQRSTUVWXY".split("");

export const LEVELS = [
  { id: 1, letters: ["A", "B", "C", "D", "E"], sticker: "🌸", stickerName: "Blossom" },
  { id: 2, letters: ["F", "G", "H", "I", "K"], sticker: "🐝", stickerName: "Busy Bee" },
  { id: 3, letters: ["L", "M", "N", "O", "P"], sticker: "🌈", stickerName: "Rainbow" },
  { id: 4, letters: ["Q", "R", "S", "T", "U"], sticker: "🦋", stickerName: "Butterfly" },
  { id: 5, letters: ["V", "W", "X", "Y"], sticker: "⭐", stickerName: "Gold Star" },
];

export const HINTS = {
  A: "Make a fist with your thumb resting against the side of your index finger.",
  B: "Hold four fingers straight up and together, with your thumb folded across your palm.",
  C: "Curve your fingers and thumb into the shape of a C.",
  D: "Point your index finger up. Curve the other fingers so they touch your thumb.",
  E: "Bend your fingertips down so they rest on your thumb, tucked across your palm.",
  F: "Touch your index finger and thumb in a circle. Keep the other three fingers up and spread.",
  G: "Point your index finger and thumb sideways, parallel to each other, with the other fingers closed.",
  H: "Point your index and middle fingers sideways together, with your thumb tucked.",
  I: "Raise your pinky. Keep the other fingers in a fist with your thumb across them.",
  K: "Raise your index and middle fingers in a V, with your thumb touching the middle of your middle finger.",
  L: "Point your index finger up and your thumb out to make an L.",
  M: "Fold your index, middle, and ring fingers over your tucked thumb.",
  N: "Fold your index and middle fingers over your tucked thumb.",
  O: "Curve all your fingertips to meet your thumb in an O.",
  P: "Make a K, then turn your hand so your fingers point down.",
  Q: "Make a G, then turn your hand so your index finger and thumb point down.",
  R: "Cross your middle finger over your index finger, pointing up.",
  S: "Make a fist with your thumb wrapped across the front of your fingers.",
  T: "Make a fist with your thumb tucked between your index and middle fingers.",
  U: "Hold your index and middle fingers straight up and together.",
  V: "Hold your index and middle fingers up and spread apart in a V.",
  W: "Hold your index, middle, and ring fingers up and spread apart.",
  X: "Raise your index finger and bend it into a hook. Keep the other fingers closed.",
  Y: "Stretch out your thumb and pinky. Fold the middle three fingers down.",
};
