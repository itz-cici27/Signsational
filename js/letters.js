// Static fingerspelling letters, recognised from a single frame (recorder.html, train.py).
export const LETTERS = "ABCDEFGHIKLMNOPQRSTUVWXY".split("");

// J and Z are traced in the air, so they use the clip model from signs.js instead
// (record them in words-recorder.html, then run train_words.py).
export const MOTION_LETTERS = ["J", "Z"];

// Reference photo of a still letter. The photos are mirrored for left-handed signers.
export const letterPhoto = (letter, leftHanded) => `assets/signs/${leftHanded ? "right" : "left"}/${letter}.jpg`;

// J and Z are traced in the air, so they get a looping video (ASL Signbank, via SignASL.org)
// instead of a still photo.
export const LETTER_VIDEOS = {
  J: "https://media.signbsl.com/videos/asl/aslsignbank/mp4/LETTER-J-1668.mp4",
  Z: "https://media.signbsl.com/videos/asl/aslsignbank/mp4/LETTER-Z-1652.mp4",
};

export const LEVELS = [
  { id: 1, letters: ["A", "B", "C", "D", "E"], sticker: "🌸", stickerName: "Blossom" },
  { id: 2, letters: ["F", "G", "H", "I", "J", "K"], sticker: "🐝", stickerName: "Busy Bee" },
  { id: 3, letters: ["L", "M", "N", "O", "P"], sticker: "🌈", stickerName: "Rainbow" },
  { id: 4, letters: ["Q", "R", "S", "T", "U"], sticker: "🦋", stickerName: "Butterfly" },
  { id: 5, letters: ["V", "W", "X", "Y", "Z"], sticker: "⭐", stickerName: "Gold Star" },
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
  J: "Make an I with your pinky up, then draw a J in the air with your pinky: down, then curve toward you.",
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
  Z: "Point your index finger and draw a Z in the air: across, diagonally down, then across again.",
};

// Word fingerspelling challenges. Letters must be in LETTERS or MOTION_LETTERS.
export const WORD_SETS = [
  { id: "w1", name: "First Words", reward: 30, words: ["CAT", "DOG", "SUN", "CUP", "BIG", "RED"] },
  { id: "w2", name: "Animal Friends", reward: 40, words: ["FISH", "BIRD", "FROG", "DUCK", "BEAR"] },
  { id: "w3", name: "Dream Big", reward: 50, words: ["SMILE", "LIGHT", "MUSIC", "WATER", "DREAM"] },
  { id: "w4", name: "Super Speller", reward: 65, words: ["PURPLE", "BRIGHT", "BASKET", "SIMPLE"] },
];

export const SHOP_RARITIES = [
  { id: "common", label: "Common", color: "#7a8b99", bg: "#F0EEF3" },
  { id: "uncommon", label: "Uncommon", color: "#2FA87A", bg: "#E6F7EF" },
  { id: "rare", label: "Rare", color: "#4A90D9", bg: "#E4EEFA" },
  { id: "epic", label: "Epic", color: "#9B59B6", bg: "#F0E4FA" },
  { id: "legendary", label: "Legendary", color: "#FF6FAE", bg: "linear-gradient(135deg, #FFF0F7 0%, #FFF6E0 50%, #F0F0FF 100%)" },
];

export const SHOP_ITEMS = [
  // Common (15–40 coins)
  { id: "bow", name: "Pink Bow", price: 15, emoji: "\u{1F380}", description: "A cute bow for Mochi", rarity: "common" },
  { id: "star", name: "Star Badge", price: 20, emoji: "\u2B50", description: "A shiny badge of honor", rarity: "common" },
  { id: "heart", name: "Heart Pin", price: 25, emoji: "\u2764\uFE0F", description: "Wear your heart on top", rarity: "common" },
  { id: "leaf", name: "Lucky Leaf", price: 30, emoji: "\u{1F343}", description: "A little extra luck", rarity: "common" },
  { id: "cherry", name: "Cherry", price: 30, emoji: "\u{1F352}", description: "Sweet on top", rarity: "common" },
  { id: "balloon", name: "Balloon", price: 35, emoji: "\u{1F388}", description: "Up, up, and away!", rarity: "common" },

  // Uncommon (50–90 coins)
  { id: "sunglasses", name: "Cool Shades", price: 50, emoji: "\u{1F576}\uFE0F", description: "Looking cool!", rarity: "uncommon" },
  { id: "scarf", name: "Cozy Scarf", price: 60, emoji: "\u{1F9E3}", description: "Warm and stylish", rarity: "uncommon" },
  { id: "partyhat", name: "Party Hat", price: 65, emoji: "\u{1F389}", description: "Time to celebrate!", rarity: "uncommon" },
  { id: "headband", name: "Sweatband", price: 70, emoji: "\u{1F3BD}", description: "Training hard!", rarity: "uncommon" },
  { id: "beret", name: "Beret", price: 75, emoji: "\u{1F3A8}", description: "Très chic!", rarity: "uncommon" },
  { id: "music", name: "Headphones", price: 85, emoji: "\u{1F3B5}", description: "Vibing out", rarity: "uncommon" },

  // Rare (100–175 coins)
  { id: "flower", name: "Flower Crown", price: 100, emoji: "\u{1F33A}", description: "A crown of flowers", rarity: "rare" },
  { id: "tophat", name: "Top Hat", price: 120, emoji: "\u{1F3A9}", description: "Feeling fancy", rarity: "rare" },
  { id: "butterfly", name: "Butterfly Wings", price: 140, emoji: "\u{1F98B}", description: "Ready to fly!", rarity: "rare" },
  { id: "tiara", name: "Tiara", price: 150, emoji: "\u{1F48E}", description: "Sparkle and shine", rarity: "rare" },
  { id: "antenna", name: "Alien Antenna", price: 165, emoji: "\u{1F47D}", description: "Out of this world", rarity: "rare" },

  // Epic (200–400 coins)
  { id: "crown", name: "Royal Crown", price: 200, emoji: "\u{1F451}", description: "Fit for royalty", rarity: "epic" },
  { id: "cape", name: "Hero Cape", price: 250, emoji: "\u{1F9B8}", description: "Every hero needs a cape", rarity: "epic" },
  { id: "wizard", name: "Wizard Hat", price: 300, emoji: "\u{1FA84}", description: "Pure magic", rarity: "epic" },
  { id: "flame", name: "Fire Crown", price: 350, emoji: "\u{1F525}", description: "On fire!", rarity: "epic" },
  { id: "astronaut", name: "Space Helmet", price: 400, emoji: "\u{1F680}", description: "To the moon!", rarity: "epic" },

  // Legendary (500+ coins)
  { id: "halo", name: "Golden Halo", price: 500, emoji: "\u{1F31F}", description: "Angelic glow", rarity: "legendary" },
  { id: "rainbow", name: "Rainbow Aura", price: 750, emoji: "\u{1F308}", description: "Maximum sparkle", rarity: "legendary" },
  { id: "dragon", name: "Dragon Horns", price: 1000, emoji: "\u{1F432}", description: "Legendary power", rarity: "legendary" },
  { id: "unicorn", name: "Unicorn Horn", price: 1500, emoji: "\u{1F984}", description: "One of a kind", rarity: "legendary" },
];
