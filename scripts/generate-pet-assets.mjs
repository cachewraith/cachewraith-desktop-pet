/**
 * Generates all original project-owned pixel-art pet assets:
 *   src/assets/pets/<slug>/manifest.json
 *   src/assets/pets/<slug>/thumbnail.png        (idle frame 0, 32x32)
 *   src/assets/pets/<slug>/sprites/<anim>.png   (horizontal 32x32 strips)
 *
 * Zero dependencies: pets are defined as ASCII pixel grids, frames are
 * synthesized (bob, blink, jump, chew, sparkles…) and encoded as PNG with
 * node:zlib. Run: node scripts/generate-pet-assets.mjs
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CANVAS = 32;

// ---------- tiny PNG encoder (same approach as generate-icon.mjs) ----------
const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function encodePng(rgba, width, height) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------- frame drawing ----------
function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

class Frame {
  constructor() {
    this.buf = Buffer.alloc(CANVAS * CANVAS * 4);
  }
  set(x, y, hex) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= CANVAS || y >= CANVAS || !hex) return;
    const [r, g, b] = hexToRgb(hex);
    const i = (y * CANVAS + x) * 4;
    this.buf[i] = r;
    this.buf[i + 1] = g;
    this.buf[i + 2] = b;
    this.buf[i + 3] = 255;
  }
}

/**
 * Render one frame of a pet.
 * state: { dx, dy, eyes: 'open'|'closed'|'sad', mouth: 'closed'|'open', extras: [[x,y,hex]] }
 */
function renderFrame(pet, state) {
  const frame = new Frame();
  const rows = pet.art;
  const artH = rows.length;
  const artW = Math.max(...rows.map((r) => r.length));
  const offX = Math.floor((CANVAS - artW) / 2) + (state.dx ?? 0);
  const offY = CANVAS - 2 - artH + (state.dy ?? 0);

  for (let y = 0; y < artH; y++) {
    const row = rows[y];
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === '.' || ch === ' ') continue;
      let color;
      if (ch === 'E') {
        const belowIsEye = y + 1 < artH && rows[y + 1][x] === 'E';
        const aboveIsEye = y > 0 && rows[y - 1][x] === 'E';
        if (state.eyes === 'closed') {
          // Eyes shut: body color, with a dark lid line on the bottom cell.
          color = belowIsEye ? pet.cover : pet.lineColor;
        } else if (state.eyes === 'sad' && belowIsEye && !aboveIsEye) {
          // Half-lidded: cover the top cell of a vertical eye pair.
          color = pet.cover;
        } else {
          color = pet.eyeColor;
        }
      } else if (ch === 'M') {
        color = state.mouth === 'open' ? pet.lineColor : pet.cover;
      } else {
        color = pet.palette[ch];
      }
      frame.set(offX + x, offY + y, color);
    }
  }

  for (const [x, y, hex] of state.extras ?? []) {
    frame.set(x, y, hex);
  }
  return frame;
}

// Small pixel glyphs / particles used by the animation synthesizer.
function zGlyph(x, y, color) {
  return [
    [x, y, color],
    [x + 1, y, color],
    [x + 2, y, color],
    [x + 1, y + 1, color],
    [x, y + 2, color],
    [x + 1, y + 2, color],
    [x + 2, y + 2, color],
  ];
}
function sparkle(x, y, color) {
  return [
    [x, y, color],
    [x - 1, y, color],
    [x + 1, y, color],
    [x, y - 1, color],
    [x, y + 1, color],
  ];
}

/** Build every animation for a pet as arrays of Frame states. */
function buildAnimations(pet) {
  const spark = pet.particleColors;
  const s = (i) => spark[i % spark.length];
  const anims = {};

  anims.idle = {
    frameRate: 5,
    frames: [
      { dy: 0, eyes: 'open' },
      { dy: -1, eyes: 'open' },
      { dy: -1, eyes: 'open' },
      { dy: 0, eyes: 'closed' },
    ],
  };
  anims.walk = {
    frameRate: 8,
    frames: [0, 1, 1, 0, -1, -1].map((dx, i) => ({
      dx,
      dy: i % 3 === 1 ? -1 : 0,
      eyes: 'open',
    })),
  };
  anims.sleep = {
    frameRate: 3,
    frames: [0, 1, 2, 3].map((i) => ({
      dy: 1 + (i > 1 ? 1 : 0),
      eyes: 'closed',
      extras: zGlyph(23, 4 - i, '#cdd9ff'),
    })),
  };
  anims.happy = {
    frameRate: 8,
    frames: [0, -3, -6, -6, -3, 0].map((dy, i) => ({
      dy,
      eyes: 'open',
      mouth: i >= 1 && i <= 4 ? 'open' : 'closed',
    })),
  };
  anims.sad = {
    frameRate: 4,
    frames: [1, 2, 2, 1].map((dy, i) => ({
      dy,
      eyes: 'sad',
      extras: i === 1 || i === 2 ? [[pet.tearX, pet.tearY + i, '#7fd8ff']] : [],
    })),
  };
  anims.hungry = {
    frameRate: 5,
    frames: [-1, 0, 1, 0].map((dx) => ({ dx, eyes: 'open', mouth: 'open' })),
  };
  anims.eat = {
    frameRate: 7,
    frames: [0, 1, 2, 3, 4, 5].map((i) => ({
      dy: i % 2,
      eyes: 'open',
      mouth: i % 2 === 0 ? 'open' : 'closed',
      extras:
        i < 4
          ? [
              [15, 29 - (i % 2), '#ffb066'],
              [16, 29 - (i % 2), '#ffb066'],
              [15, 30, '#e08840'],
            ]
          : [],
    })),
  };
  anims.talk = {
    frameRate: 8,
    frames: [0, 1, 2, 3, 4, 5].map((i) => ({
      dy: i === 2 || i === 3 ? -1 : 0,
      eyes: 'open',
      mouth: i % 2 === 0 ? 'open' : 'closed',
    })),
  };
  anims.celebrate = {
    frameRate: 9,
    frames: [0, -4, -7, -7, -4, 0, -2, 0].map((dy, i) => ({
      dy,
      eyes: 'open',
      mouth: 'open',
      extras: [
        ...sparkle(4 + ((i * 3) % 8), 6 + ((i * 2) % 6), s(i)),
        ...sparkle(26 - ((i * 2) % 7), 5 + ((i * 3) % 7), s(i + 1)),
        ...sparkle(8 + ((i * 5) % 16), 2 + (i % 3), s(i + 2)),
      ],
    })),
  };
  return anims;
}

// ---------- the twelve original pets ----------
// Art legend: '.' transparent, 'E' eyes, 'M' mouth, other chars per palette.
const PETS = [
  {
    slug: 'cachewraith',
    number: 1,
    name: 'CacheWraith',
    description: 'A friendly purple cache ghost that haunts your taskbar.',
    lore: 'Born in a forgotten browser cache, CacheWraith chose companionship over hauntings. It tidies stray bits while you work.',
    personality: 'Playful, supportive and a little mischievous.',
    category: 'ghost',
    rarity: 'common',
    tags: ['ghost', 'classic', 'starter'],
    featured: true,
    new: false,
    free: true,
    defaultUnlocked: true,
    cover: '#bfa8ff',
    lineColor: '#2b1b4d',
    eyeColor: '#2b1b4d',
    tearX: 10,
    tearY: 20,
    particle: 'spark',
    particleColors: ['#9d8cff', '#4fd8ff', '#ffd166'],
    effects: { glowColor: '#4fd8ff', idleFloatAmount: 4, idleFloatSpeed: 1.4 },
    palette: { p: '#bfa8ff', l: '#e0d4ff', d: '#8f7ae0', b: '#ff9ad5' },
    art: [
      '......pppppppppp......',
      '....pppppppppppppp....',
      '...ppllpppppppppppp...',
      '..pplppppppppppppppp..',
      '..pppppppppppppppppp..',
      '..ppEEppppppppppEEpp..',
      '..ppEEppppppppppEEpp..',
      '..pppppppppppppppppp..',
      '..pppppppppMMppppppp..',
      '..ppbbppppppppppbbpp..',
      '..pppppppppppppppppp..',
      '..pppppppppppppppppp..',
      '..ppp.pppp.ppp.ppp.p..',
      '..pp...pp...pp...pp...',
    ],
    dialogue: {
      greeting: ["I'm awake. What are we building today?", 'Boo! …Sorry, ghost habits.'],
      clicked: ['Boo! 👻', 'The cache spirits approve.', "You've got this."],
      hungry: ['My ectoplasm is rumbling…', 'A byte-sized snack would be lovely.'],
      fed: ['Nom nom… ✨', 'Delicious data!'],
      happy: ['Cozy taskbar, best taskbar.', 'Hehe~'],
      sleeping: ['zzz… defragmenting dreams…'],
      celebrating: ['Cache cleared! Confetti time!'],
    },
  },
  {
    slug: 'byte-bunny',
    number: 2,
    name: 'ByteBunny',
    description: 'A small cyber rabbit with signal-antenna ears.',
    lore: 'ByteBunny hopped out of a lossless archive. Its ears twitch whenever packets fly by.',
    personality: 'Energetic, curious and endlessly optimistic.',
    category: 'animal',
    rarity: 'common',
    tags: ['rabbit', 'cyber', 'starter'],
    featured: false,
    new: false,
    free: true,
    defaultUnlocked: true,
    cover: '#e8ecff',
    lineColor: '#2a2a4a',
    eyeColor: '#2a2a4a',
    tearX: 11,
    tearY: 22,
    particle: 'pixel',
    particleColors: ['#7fa8ff', '#e8ecff', '#4fd8ff'],
    effects: { glowColor: '#7fa8ff', idleFloatAmount: 1, idleFloatSpeed: 2 },
    palette: { p: '#e8ecff', d: '#9aa8e0', n: '#ff9ad5', l: '#ffffff' },
    art: [
      '....dd........dd....',
      '...dppd......dppd...',
      '...dppd......dppd...',
      '...dppd......dppd...',
      '....dpd......dpd....',
      '....pppppppppppp....',
      '...pppppppppppppp...',
      '..pplppppppppppppp..',
      '..ppEEppppppppEEpp..',
      '..ppEEppppppppEEpp..',
      '..ppppppnnpppppppp..',
      '..pppppppMMppppppp..',
      '...pppppppppppppp...',
      '..pppp..pppp..ppp...',
    ],
    dialogue: {
      greeting: ['*ears perk up* New packets incoming!', 'Hop hop! Ready to build?'],
      clicked: ['Boing!', '*happy ear wiggle*', 'Ping received!'],
      hungry: ['Carrot bits, please. Literal bits.', 'My battery-tummy is low…'],
      fed: ['Crunchy! Thank you!', '*nibbles happily*'],
      happy: ['Everything is downloading smoothly!', 'Wheee!'],
      sleeping: ['zzz… hopping through dreams…'],
      celebrating: ['Triple hop! We did it!'],
    },
  },
  {
    slug: 'null-cat',
    number: 3,
    name: 'NullCat',
    description: 'A black pixel cat with glowing cyan eyes.',
    lore: 'NullCat lives in the space between defined variables. It sees everything and comments on very little.',
    personality: 'Observant, dryly funny and quietly supportive.',
    category: 'animal',
    rarity: 'rare',
    tags: ['cat', 'dark', 'mysterious'],
    featured: true,
    new: false,
    free: true,
    defaultUnlocked: false,
    cover: '#23233a',
    lineColor: '#4fd8ff',
    eyeColor: '#4fd8ff',
    tearX: 10,
    tearY: 20,
    particle: 'pixel',
    particleColors: ['#4fd8ff', '#23233a', '#8fa0e0'],
    effects: {
      glowColor: '#4fd8ff',
      shadowColor: '#101020',
      idleFloatAmount: 1,
      idleFloatSpeed: 1,
    },
    palette: { d: '#23233a', k: '#15152a', w: '#4fd8ff', n: '#ff9ad5' },
    art: [
      '..d..............d....',
      '..dd............dd....',
      '..dkd..........dkd....',
      '..dddddddddddddddd....',
      '..dddddddddddddddd....',
      '..ddEEddddddddEEdd....',
      '..ddEEddddddddEEdd....',
      '..ddddddddnnpddddd....',
      '..dddddddMMddddddd....',
      '..dddddddddddddddd.dd.',
      '..dddddddddddddddddd..',
      '..ddd..dddd..ddd......',
    ],
    dialogue: {
      greeting: ['…oh. You’re here. Acceptable.', '*stares meaningfully*'],
      clicked: ['*slow blink of approval*', 'I permit this.', 'Undefined behavior. I like it.'],
      hungry: ['The void requires kibble.', 'Feed me or face judgmental staring.'],
      fed: ['*purrs in hexadecimal*', 'Adequate. Continue.'],
      happy: ['This pleases the null.', '*tail curls contentedly*'],
      sleeping: ['zzz… (even asleep, it judges)'],
      celebrating: ['A rare display of enthusiasm.'],
    },
  },
  {
    slug: 'ping-pup',
    number: 4,
    name: 'PingPup',
    description: 'A cheerful network puppy that fetches every packet.',
    lore: 'PingPup answers every ping with a wag. Latency has never been this adorable.',
    personality: 'Loyal, bouncy and eager to please.',
    category: 'animal',
    rarity: 'common',
    tags: ['dog', 'network', 'starter'],
    featured: false,
    new: false,
    free: true,
    defaultUnlocked: true,
    cover: '#e0b98a',
    lineColor: '#3a2a1a',
    eyeColor: '#3a2a1a',
    tearX: 10,
    tearY: 21,
    particle: 'star',
    particleColors: ['#ffd166', '#e0b98a', '#4fd8ff'],
    effects: { glowColor: '#ffd166', idleFloatAmount: 1, idleFloatSpeed: 2.2 },
    palette: { p: '#e0b98a', b: '#a87848', n: '#3a2a1a', l: '#f4d8b0' },
    art: [
      '..bb..............bb..',
      '.bbbb............bbbb.',
      '.bbppppppppppppppppbb.',
      '..pppppppppppppppp....',
      '..pplppppppppppppp....',
      '..ppEEppppppppEEpp....',
      '..ppEEppppppppEEpp....',
      '..ppppppppnnpppppp....',
      '..pppppppMMMppppppp...',
      '..pppppppppppppppp.b..',
      '...ppppppppppppppp.bb.',
      '..ppp..pppp..ppp......',
    ],
    dialogue: {
      greeting: ['*excited tail wag* You’re back!', 'Woof! 0ms response time!'],
      clicked: ['*happy bark*', 'Again! Again!', '*rolls over*'],
      hungry: ['*sad puppy eyes at the treat jar*', 'Snack request timed out…'],
      fed: ['*chomp chomp* Best day ever!', 'Woof! Thank you!'],
      happy: ['Everything is fetchable!', '*zoomies*'],
      sleeping: ['zzz… *paws twitch, chasing packets*'],
      celebrating: ['WOOF WOOF! Victory zoomies!'],
    },
  },
  {
    slug: 'stack-bot',
    number: 5,
    name: 'StackBot',
    description: 'A tiny orange utility robot with status lights.',
    lore: 'Assembled from leftover CI runners, StackBot lives to help. Its lights blink green when your builds pass.',
    personality: 'Precise, earnest and secretly sentimental.',
    category: 'robot',
    rarity: 'uncommon',
    tags: ['robot', 'utility', 'starter'],
    featured: false,
    new: true,
    free: true,
    defaultUnlocked: true,
    cover: '#f0a050',
    lineColor: '#2a2a3a',
    eyeColor: '#20e0a0',
    tearX: 11,
    tearY: 20,
    particle: 'pixel',
    particleColors: ['#20e0a0', '#f0a050', '#4fd8ff'],
    effects: { glowColor: '#20e0a0', idleFloatAmount: 0, idleFloatSpeed: 1 },
    palette: { o: '#f0a050', a: '#c0c8d8', g: '#20e0a0', t: '#3a3a4a', r: '#ff6b6b' },
    art: [
      '.........aa.........',
      '.........aa.........',
      '......aaaaaaaa......',
      '....oooooooooooo....',
      '...oooooooooooooo...',
      '...ooEEooooooEEoo...',
      '...ooEEooooooEEoo...',
      '...oooooooooooooo...',
      '...oooooMMMMooooo...',
      '...oooooooooooooo...',
      '...og.or.og.or.oo...',
      '....tttttttttttt....',
      '...tt.tt.tt.tt.tt...',
    ],
    dialogue: {
      greeting: ['StackBot online. All systems nominal.', 'Boot complete. Hello, operator.'],
      clicked: ['Interaction logged. Warmth levels rising.', 'Beep! (that means thank you)'],
      hungry: [
        'Fuel cells at 12%. Requesting snacks.',
        'Energy low. Deploying puppy-eye subroutine.',
      ],
      fed: ['Recharging… delicious.', 'Fuel accepted. Efficiency +8%.'],
      happy: ['Status lights: all green!', 'Emotional subroutines report: joy.'],
      sleeping: ['Entering low-power mode… zzz…'],
      celebrating: ['BUILD PASSED! Confetti protocol engaged!'],
    },
  },
  {
    slug: 'glitch-slime',
    number: 6,
    name: 'GlitchSlime',
    description: 'A color-shifting digital slime that wobbles happily.',
    lore: 'A rendering bug that gained sentience and decided to be delightful instead of fixed.',
    personality: 'Chaotic, cheerful and full of surprises.',
    category: 'slime',
    rarity: 'rare',
    tags: ['slime', 'glitch', 'colorful'],
    featured: false,
    new: true,
    free: true,
    defaultUnlocked: false,
    cover: '#66e08a',
    lineColor: '#1a3a2a',
    eyeColor: '#1a3a2a',
    tearX: 11,
    tearY: 21,
    particle: 'pixel',
    particleColors: ['#66e08a', '#e066d8', '#4fd8ff', '#ffd166'],
    effects: { glowColor: '#66e08a', idleFloatAmount: 2, idleFloatSpeed: 2.4, glitch: true },
    palette: { g: '#66e08a', m: '#e066d8', c: '#4fd8ff', d: '#3aa860' },
    art: [
      '......gggggggg......',
      '....gggggggggggg....',
      '...gggmggggggcggg...',
      '..gggggggggggggggg..',
      '..ggEEggggggggEEgg..',
      '..ggEEggggggggEEgg..',
      '.gggggggmggggggggg..',
      '.ggggggggMMggggggm..',
      '.ggcggggggggggggggg.',
      '.ggggggggggggdggggg.',
      '..gggggggggggggggg..',
    ],
    dialogue: {
      greeting: ['blorp! h̸e̷l̶l̷o̴ friend!', '*wobbles in greeting*'],
      clicked: ['*jiggles delightedly*', 'squish!', 'b̷l̶o̸r̷p̶?'],
      hungry: ['tummy.exe has stopped respo̶n̸d̷i̶ng…', '*hungry wobble*'],
      fed: ['*absorbs snack* yummm!', 'blorp blorp blorp!'],
      happy: ['*vibrates in six colors*', 'happiness overflow!'],
      sleeping: ['zzz… *melts into a calm puddle*'],
      celebrating: ['*explodes into confetti pixels and reassembles*'],
    },
  },
  {
    slug: 'ember-fox',
    number: 7,
    name: 'EmberFox',
    description: 'A small fire fox with a flame-tipped tail.',
    lore: 'EmberFox curled up inside an overheating GPU and absorbed its warmth. Now it keeps your desktop cozy instead.',
    personality: 'Warm, spirited and fiercely encouraging.',
    category: 'elemental',
    rarity: 'epic',
    tags: ['fox', 'fire', 'elemental'],
    featured: true,
    new: false,
    free: true,
    defaultUnlocked: false,
    cover: '#f08a50',
    lineColor: '#4a1a10',
    eyeColor: '#4a1a10',
    tearX: 10,
    tearY: 20,
    particle: 'spark',
    particleColors: ['#ffd166', '#ff8a50', '#ff5a3a'],
    effects: {
      glowColor: '#ff8a50',
      idleFloatAmount: 1,
      idleFloatSpeed: 1.8,
      ambientParticle: 'spark',
    },
    palette: { f: '#f08a50', d: '#c05a30', w: '#ffe8d0', y: '#ffd166', n: '#4a1a10' },
    art: [
      '...ff..........ff.....',
      '..fddf........fddf....',
      '..ffff........ffff....',
      '...ffffffffffffff.....',
      '..ffffffffffffffff....',
      '..ffEEffffffffEEff....',
      '..ffEEffffffffEEff....',
      '..fwwffffffffffwwf....',
      '..ffffffffnnffffff....',
      '..fffffffMMfffffff..yy',
      '...ffffffffffffff..yf.',
      '..fff..ffff..fff..ff..',
    ],
    dialogue: {
      greeting: ['*tail flame flickers brightly* Hello!', 'The hearth is lit. Let’s create.'],
      clicked: ['*warm nuzzle*', 'Careful — toasty!', '*happy crackle*'],
      hungry: ['My inner flame needs kindling…', '*stomach growls like embers*'],
      fed: ['*happy crackling sounds*', 'Mmm, fuel for the fire!'],
      happy: ['Burning bright today!', '*tail flame does a little dance*'],
      sleeping: ['zzz… *embers glow softly*'],
      celebrating: ['*erupts in celebratory sparks!*'],
    },
  },
  {
    slug: 'moss-munch',
    number: 8,
    name: 'MossMunch',
    description: 'A tiny forest creature covered in soft moss.',
    lore: 'MossMunch grew on an old server that was never rebooted. It brings the calm of a forest floor to your desktop.',
    personality: 'Gentle, patient and quietly wise.',
    category: 'nature',
    rarity: 'uncommon',
    tags: ['nature', 'moss', 'cozy'],
    featured: false,
    new: false,
    free: true,
    defaultUnlocked: false,
    cover: '#7ac06a',
    lineColor: '#2a3a1a',
    eyeColor: '#2a3a1a',
    tearX: 11,
    tearY: 21,
    particle: 'leaf',
    particleColors: ['#9ae07a', '#5a9a4a', '#c8e8a0'],
    effects: {
      glowColor: '#9ae07a',
      idleFloatAmount: 1,
      idleFloatSpeed: 0.9,
      ambientParticle: 'leaf',
    },
    palette: { m: '#7ac06a', D: '#4a8a3a', s: '#9ae07a', t: '#8a6a4a' },
    art: [
      '.........ss.........',
      '........ss.s........',
      '.........t..........',
      '......mmmmmmmm......',
      '....mmmmmmmmmmmm....',
      '...mmDmmmmmmmDmmm...',
      '..mmmmmmmmmmmmmmmm..',
      '..mmEEmmmmmmmmEEmm..',
      '..mmEEmmmmmmmmEEmm..',
      '..mmmmmmMMMMmmmmmm..',
      '..mDmmmmmmmmmmmDmm..',
      '...mmmmmmmmmmmmmm...',
      '....mm..mmmm..mm....',
    ],
    dialogue: {
      greeting: ['*rustles softly* …hello.', 'The forest says good day.'],
      clicked: ['*soft mossy squish*', '…that was nice.', '*a tiny sprout wiggles*'],
      hungry: ['…could use some sunlight and snacks.', '*photosynthesis intensifies hopefully*'],
      fed: ['*munch munch munch* …thank you.', 'Nutrients absorbed. Growing happily.'],
      happy: ['*blooms a tiny flower*', 'The moss is content.'],
      sleeping: ['zzz… *dew settles gently*'],
      celebrating: ['*sheds celebratory leaves!*'],
    },
  },
  {
    slug: 'lunar-moth',
    number: 9,
    name: 'LunarMoth',
    description: 'A floating moon moth that drifts on starlight.',
    lore: 'LunarMoth navigated to your screen by mistaking it for the moon. It decided to stay anyway.',
    personality: 'Dreamy, serene and softly poetic.',
    category: 'fantasy',
    rarity: 'epic',
    tags: ['moth', 'moon', 'dreamy'],
    featured: false,
    new: true,
    free: true,
    defaultUnlocked: false,
    cover: '#d8d0f0',
    lineColor: '#3a3050',
    eyeColor: '#3a3050',
    tearX: 12,
    tearY: 19,
    particle: 'star',
    particleColors: ['#e8e0ff', '#b8a8ff', '#4fd8ff'],
    effects: {
      glowColor: '#b8a8ff',
      idleFloatAmount: 5,
      idleFloatSpeed: 1.1,
      ambientParticle: 'star',
    },
    palette: { w: '#d8d0f0', v: '#a898d8', p: '#8878b8', l: '#f4f0ff', a: '#3a3050' },
    art: [
      '...a..............a...',
      '....a............a....',
      '.wwww.w........w.wwww.',
      'wwwwwww.pppppp.wwwwwww',
      'wwlwwwwwpppppp wwwwlww',
      'wwwwwwwppEEpppwwwwwwww',
      'wwvwwwwppEEpppwwwwvwww',
      '.wwwwwwppMMppp wwwwww.',
      '.wvwwww.pppppp.wwwwvw.',
      '..wwww..pppppp..wwww..',
      '...ww....pppp....ww...',
      '..........pp..........',
    ],
    dialogue: {
      greeting: ['*drifts down gently* …the moon sends greetings.', 'Starlight suits you tonight.'],
      clicked: ['*wings shimmer*', '…soft.', '*leaves a trail of moon dust*'],
      hungry: ['…even moths need moonberries.', '*flutters toward the snack drawer*'],
      fed: ['*sips delicately* …lovely.', 'Sweet as starlight.'],
      happy: ['*glows with quiet joy*', 'The night is beautiful, and so is this.'],
      sleeping: ['zzz… *wings fold like petals*'],
      celebrating: ['*scatters moon sparkles everywhere*'],
    },
  },
  {
    slug: 'orbit-orb',
    number: 10,
    name: 'OrbitOrb',
    description: 'A small floating alien companion with its own ring.',
    lore: 'OrbitOrb escaped a screensaver in the late 2000s and has been happily orbiting desktops ever since.',
    personality: 'Curious, bubbly and endearingly literal.',
    category: 'space',
    rarity: 'rare',
    tags: ['space', 'alien', 'orb'],
    featured: false,
    new: false,
    free: true,
    defaultUnlocked: false,
    cover: '#5ad0c8',
    lineColor: '#103a3a',
    eyeColor: '#103a3a',
    tearX: 12,
    tearY: 18,
    particle: 'star',
    particleColors: ['#5ad0c8', '#ffd166', '#e8e0ff'],
    effects: { glowColor: '#5ad0c8', idleFloatAmount: 4, idleFloatSpeed: 1.6 },
    palette: { o: '#5ad0c8', l: '#a8f0e8', r: '#e8b866', d: '#38a098' },
    art: [
      '.......oooooo.......',
      '.....oolloooooo.....',
      '....oolooooooooo....',
      '...ooloooooooooooo..',
      'rr.ooooooooooooo.rr.',
      '.rrrrrrrrrrrrrrrrr..',
      '...oooooooooooooo...',
      '...ooEEooooooEEoo...',
      '...ooEEooooooEEoo...',
      '....ooooMMMooooo....',
      '.....oooooooooo.....',
      '.......odddoo.......',
    ],
    dialogue: {
      greeting: ['*descends from orbit* Greetings, surface friend!', 'Orbital check-in: hello!'],
      clicked: ['*spins ring excitedly*', 'Contact! Delightful!', '*wobbles in zero-g*'],
      hungry: ['Requesting space snacks. Any snacks. Please.', 'Fuel reserves: dramatically low.'],
      fed: [
        '*absorbs snack through ring* Fascinating AND delicious!',
        'Yum! Earth food is superior.',
      ],
      happy: ['*orbits its own happiness*', 'All systems: joyful!'],
      sleeping: ['zzz… *ring rotates slowly*'],
      celebrating: ['*launches celebratory mini-comets!*'],
    },
  },
  {
    slug: 'frost-fang',
    number: 11,
    name: 'FrostFang',
    description: 'A small ice wolf with tiny crystal fangs.',
    lore: 'FrostFang was the coolest process on a frozen machine. It thawed just enough to make friends.',
    personality: 'Calm, protective and secretly playful.',
    category: 'elemental',
    rarity: 'epic',
    tags: ['wolf', 'ice', 'elemental'],
    featured: false,
    new: false,
    free: true,
    defaultUnlocked: false,
    cover: '#a8d8f0',
    lineColor: '#1a3a5a',
    eyeColor: '#1a3a5a',
    tearX: 10,
    tearY: 20,
    particle: 'snow',
    particleColors: ['#e8f4ff', '#a8d8f0', '#4fd8ff'],
    effects: {
      glowColor: '#a8d8f0',
      idleFloatAmount: 1,
      idleFloatSpeed: 1.2,
      ambientParticle: 'snow',
    },
    palette: { i: '#a8d8f0', w: '#e8f4ff', d: '#6aa8d0', n: '#1a3a5a' },
    art: [
      '..ii..........ii....',
      '.iiii........iiii...',
      '.iiwiiiiiiiiiiwii...',
      '..iiiiiiiiiiiiii....',
      '..iiEEiiiiiiEEii....',
      '..iiEEiiiiiiEEii....',
      '..iiiiiiinniiiii....',
      '..iiiwwMMMwwiiii....',
      '..iiiiwiiiiwiiii....',
      '..iiiiiiiiiiiiii..i.',
      '...iiiiiiiiiiiii.ii.',
      '..iii..iiii..iii....',
    ],
    dialogue: {
      greeting: ['*breath fogs the screen slightly* Greetings.', 'The pack is assembled.'],
      clicked: ['*dignified tail wag*', '*cool nuzzle*', 'Hm. Acceptable warmth.'],
      hungry: ['The hunt for snacks begins…', '*stares at the fridge from afar*'],
      fed: ['*crunches appreciatively*', 'The pack eats well tonight.'],
      happy: ['*serene wolf smile*', 'All is well in the tundra.'],
      sleeping: ['zzz… *curled in a perfect frost circle*'],
      celebrating: ['*triumphant howl! snow everywhere!*'],
    },
  },
  {
    slug: 'rune-owl',
    number: 12,
    name: 'RuneOwl',
    description: 'A magical owl inscribed with softly glowing runes.',
    lore: 'RuneOwl studied at the great Library of Deprecated Docs. It knows answers to questions not yet asked.',
    personality: 'Wise, warm and delightfully cryptic.',
    category: 'fantasy',
    rarity: 'legendary',
    tags: ['owl', 'magic', 'runes'],
    featured: true,
    new: true,
    free: true,
    defaultUnlocked: false,
    cover: '#8a70b8',
    lineColor: '#2a1a40',
    eyeColor: '#ffd166',
    tearX: 10,
    tearY: 19,
    particle: 'spark',
    particleColors: ['#ffd166', '#b8a8ff', '#4fd8ff'],
    effects: { glowColor: '#b8a8ff', idleFloatAmount: 2, idleFloatSpeed: 1.0 },
    palette: { h: '#8a70b8', w: '#6a5498', f: '#d8c8f0', b: '#ffb066', r: '#ffd166' },
    art: [
      '...hh..........hh.....',
      '..hhhhhhhhhhhhhhhh....',
      '..hffEEffhhffEEffh....',
      '..hffEEffhhffEEffh....',
      '..hhffffhbbhffffhh....',
      '..whhhhhhbbhhhhhhw....',
      '..whhrhhhhhhhhrhhw....',
      '..whhhhhhMMhhhhhhw....',
      '..whhhhrhhhhhrhhhw....',
      '..wwhhhhhhhhhhhhww....',
      '...hhhhhhhhhhhhhh.....',
      '....bb..bb..bb........',
    ],
    dialogue: {
      greeting: [
        'Hoo. You arrive precisely when expected.',
        'The runes foretold a productive day.',
      ],
      clicked: [
        '*runes pulse warmly*',
        'Hoo hoo. Wisdom appreciates attention.',
        'You seek… head pats. Granted.',
      ],
      hungry: ['Even ancient wisdom requires snacks.', 'The prophecy speaks of… dinner.'],
      fed: ['*hoots gratefully*', 'A feast worthy of the old library.'],
      happy: ['The runes glow brighter today.', 'Hoo! Joy is the oldest magic.'],
      sleeping: ['zzz… *dreams in forgotten languages*'],
      celebrating: ['*runes flare in triumphant gold!*'],
    },
  },
];

// ---------- emit everything ----------
const here = dirname(fileURLToPath(import.meta.url));
const petsRoot = join(here, '..', 'src', 'assets', 'pets');
const ANIMATION_NAMES = [
  'idle',
  'walk',
  'sleep',
  'happy',
  'sad',
  'hungry',
  'eat',
  'talk',
  'celebrate',
];

for (const pet of PETS) {
  const dir = join(petsRoot, pet.slug);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(join(dir, 'sprites'), { recursive: true });

  const anims = buildAnimations(pet);
  const manifestAnimations = {};

  for (const name of ANIMATION_NAMES) {
    const anim = anims[name];
    const frames = anim.frames.map((state) => renderFrame(pet, state));
    const sheet = Buffer.alloc(CANVAS * frames.length * CANVAS * 4);
    // Compose the horizontal strip.
    for (let f = 0; f < frames.length; f++) {
      for (let y = 0; y < CANVAS; y++) {
        frames[f].buf.copy(
          sheet,
          (y * CANVAS * frames.length + f * CANVAS) * 4,
          y * CANVAS * 4,
          (y + 1) * CANVAS * 4
        );
      }
    }
    writeFileSync(
      join(dir, 'sprites', `${name}.png`),
      encodePng(sheet, CANVAS * frames.length, CANVAS)
    );
    manifestAnimations[name] = {
      name,
      asset: `sprites/${name}.png`,
      frameWidth: CANVAS,
      frameHeight: CANVAS,
      frameCount: frames.length,
      frameRate: anim.frameRate,
      loop: true,
      scale: 5,
      anchorX: 0.5,
      anchorY: 1,
    };
  }

  // Thumbnail = idle frame 0.
  writeFileSync(
    join(dir, 'thumbnail.png'),
    encodePng(renderFrame(pet, anims.idle.frames[0]).buf, CANVAS, CANVAS)
  );

  const manifest = {
    id: pet.slug,
    number: pet.number,
    name: pet.name,
    slug: pet.slug,
    description: pet.description,
    lore: pet.lore,
    personality: pet.personality,
    category: pet.category,
    rarity: pet.rarity,
    tags: pet.tags,
    featured: pet.featured,
    new: pet.new,
    free: pet.free,
    defaultUnlocked: pet.defaultUnlocked,
    thumbnail: 'thumbnail.png',
    animations: manifestAnimations,
    effects: {
      celebrationParticle: pet.particle,
      particleColors: pet.particleColors,
      ...pet.effects,
    },
    dialogue: pet.dialogue,
  };
  writeFileSync(join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`generated ${pet.slug}`);
}
console.log(`done: ${PETS.length} pets → ${petsRoot}`);
