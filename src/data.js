// All tunable game content lives here: the archipelago, ships, weapons, goods, enemies, story.

export const WORLD_R = 1450;

// kind: town | hideout | fort | ruins | crab | islet.   land: compass angle (radians) of the landing beach.
export const ISLANDS = [
  { id: 'saltmere', name: 'Saltmere', x: 0, z: 0, r: 190, h: 26, seed: 11, kind: 'town', land: 2.5, blurb: 'Free port. Every service a captain needs.' },
  { id: 'rest', name: "Rogue's Rest", x: -520, z: 400, r: 135, h: 20, seed: 23, kind: 'hideout', land: 0.9, blurb: 'Your hidden cove.' },
  { id: 'gull', name: 'Gull Rock', x: 340, z: 350, r: 72, h: 12, seed: 37, kind: 'islet', land: 4.0, blurb: 'A bare islet. Good for burying things.' },
  { id: 'regal', name: 'Port Regal', x: 840, z: -420, r: 205, h: 30, seed: 41, kind: 'town', land: 3.6, blurb: 'Navy trade port. Pays well for luxuries.' },
  { id: 'shoals', name: 'Black Shoals', x: -780, z: -560, r: 160, h: 22, seed: 53, kind: 'town', land: 0.4, blurb: "Smugglers' den. No questions asked." },
  { id: 'bones', name: 'Isle of Bones', x: 250, z: -830, r: 195, h: 34, seed: 67, kind: 'ruins', land: 1.3, blurb: 'Old ruins. The dead here do not rest.' },
  { id: 'crab', name: 'Crabclaw Key', x: -230, z: 900, r: 150, h: 14, seed: 71, kind: 'crab', land: 5.2, blurb: 'Crab nests, and something bigger.' },
  { id: 'blood', name: 'Bloodwater Hold', x: 780, z: 640, r: 150, h: 18, seed: 83, kind: 'fort', land: 3.9, blurb: 'Fort of the Bloodwater gang. Their vault is full.' },
  { id: 'tooth', name: "Widow's Tooth", x: -1020, z: 170, r: 66, h: 16, seed: 97, kind: 'islet', land: 0.2, blurb: 'A lonely spike of rock.' },
];
export const ISLAND = Object.fromEntries(ISLANDS.map((i) => [i.id, i]));

export const ZONES = {
  reach: { name: 'The Drowned Reach', x: -380, z: -1120, r: 260 },
  maw: { name: 'The Maw', x: 1130, z: 1010, r: 200 },
};

export const SHIP_CLASSES = {
  sloop: { name: 'Sloop', len: 17, beam: 5.4, masts: 1, guns: 3, hp: 110, speed: 15.5, turn: 0.62, cargo: 20, crew: 2, price: 0, level: 1 },
  brig: { name: 'Brig', len: 23, beam: 6.6, masts: 2, guns: 5, hp: 210, speed: 14, turn: 0.5, cargo: 40, crew: 3, price: 2400, level: 4 },
  frigate: { name: 'Frigate', len: 30, beam: 7.8, masts: 3, guns: 8, hp: 360, speed: 13, turn: 0.42, cargo: 64, crew: 4, price: 8500, level: 8 },
};

// Each track has 5 levels. cost(level) = base * (level+1)^1.5
export const SHIP_UPGRADES = {
  hull: { name: 'Hull plating', desc: '+18% hull strength', gold: 150, timber: 12, iron: 4 },
  sails: { name: 'Sailcloth', desc: '+5% speed and turning', gold: 130, timber: 6, iron: 0 },
  cannons: { name: 'Gun deck', desc: '+15% damage, faster reload', gold: 180, timber: 4, iron: 12 },
  hold: { name: 'Cargo hold', desc: '+25% cargo space', gold: 110, timber: 14, iron: 0 },
  crew: { name: 'Crew berths', desc: '+1 fighter when boarding (every 2 levels)', gold: 160, timber: 8, iron: 4 },
};
export const MAX_UPGRADE = 5;

export const SWORDS = [
  { name: 'Rusty Cutlass', dmg: 14, gold: 0, iron: 0 },
  { name: 'Steel Cutlass', dmg: 19, gold: 260, iron: 8 },
  { name: "Officer's Sabre", dmg: 25, gold: 700, iron: 18 },
  { name: 'Damascus Blade', dmg: 33, gold: 1700, iron: 36 },
  { name: 'Stormbreaker', dmg: 44, gold: 4200, iron: 70 },
];
export const GUNS = [
  { name: 'Flintlock Pistol', dmg: 42, reload: 5.0, gold: 0, iron: 0 },
  { name: 'Brace of Pistols', dmg: 52, reload: 3.6, gold: 320, iron: 10 },
  { name: 'Long Musket', dmg: 82, reload: 4.4, gold: 900, iron: 22 },
  { name: 'Dragon Blunderbuss', dmg: 118, reload: 4.6, gold: 2400, iron: 48 },
];

export const GOODS = {
  rum: { name: 'Rum', price: 20 }, sugar: { name: 'Sugar', price: 30 }, tobacco: { name: 'Tobacco', price: 46 },
  powder: { name: 'Gunpowder', price: 60 }, spice: { name: 'Spice', price: 74 }, silk: { name: 'Silk', price: 112 },
};
export const PORT_PRICES = {
  saltmere: { rum: 0.8, sugar: 1.0, tobacco: 1.1, powder: 1.0, spice: 1.2, silk: 1.15 },
  regal: { rum: 1.35, sugar: 1.3, tobacco: 0.8, powder: 1.3, spice: 0.75, silk: 0.8 },
  shoals: { rum: 1.05, sugar: 0.7, tobacco: 1.3, powder: 0.65, spice: 1.38, silk: 1.42 },
};

// Hideout buildings. Production is per hour at level 1 and scales with level.
export const BUILDINGS = {
  vault: { name: 'Vault', desc: 'Keeps a share of your gold safe when you fall (and from raiders, later).', gold: 200, timber: 20, iron: 10, fx: (l) => `${l * 25}% of gold protected` },
  lumber: { name: 'Lumber Camp', desc: 'Cuts timber while you are away.', gold: 120, timber: 0, iron: 4, prod: { timber: 30 }, fx: (l) => `${l * 30} timber / hour` },
  mine: { name: 'Iron Mine', desc: 'Digs iron while you are away.', gold: 180, timber: 16, iron: 0, prod: { iron: 18 }, fx: (l) => `${l * 18} iron / hour` },
  still: { name: 'Distillery', desc: 'Sells rum to passing ships for steady gold.', gold: 260, timber: 24, iron: 8, prod: { gold: 140 }, fx: (l) => `${l * 140} gold / hour` },
  quarters: { name: 'Crew Quarters', desc: 'Houses fighters who board beside you.', gold: 300, timber: 30, iron: 6, fx: (l) => `+${l} boarding crew` },
  battery: { name: 'Gun Battery', desc: 'Shore guns. Defends the cove once raiders come.', gold: 340, timber: 18, iron: 30, fx: (l) => `Defence ${l * 100}` },
};
export const MAX_BUILDING = 3;
export const PROD_CAP_HOURS = 8;

// Foot enemies. tele = wind-up seconds before a strike lands.
export const FOES = {
  brigand: { name: 'Brigand', hp: 42, dmg: 10, speed: 3.7, tele: 0.55, look: 'brigand', xp: 12, gold: [4, 14] },
  marksman: { name: 'Marksman', hp: 30, dmg: 15, speed: 3.2, tele: 1.25, look: 'marksman', ranged: true, xp: 14, gold: [5, 16] },
  brute: { name: 'Brute', hp: 120, dmg: 24, speed: 2.9, tele: 0.95, look: 'brute', heavy: true, scale: 1.22, xp: 30, gold: [14, 34] },
  captain: { name: 'Captain', hp: 170, dmg: 17, speed: 4.0, tele: 0.5, look: 'captain', scale: 1.08, xp: 50, gold: [40, 90] },
  soldier: { name: 'Marine', hp: 52, dmg: 12, speed: 3.6, tele: 0.55, look: 'soldier', xp: 14, gold: [6, 16] },
  skeleton: { name: 'Cursed Dead', hp: 36, dmg: 12, speed: 3.9, tele: 0.5, look: 'skeleton', xp: 14, gold: [2, 10] },
  crab: { name: 'Giant Crab', hp: 34, dmg: 9, speed: 4.4, tele: 0.45, look: 'crab', xp: 10, gold: [0, 4] },
  crabking: { name: 'The Crab King', hp: 520, dmg: 26, speed: 3.4, tele: 0.85, look: 'crab', heavy: true, scale: 3.2, boss: true, xp: 300, gold: [350, 500] },
  crew: { name: 'Crewmate', hp: 70, dmg: 11, speed: 4.0, tele: 0.5, look: 'crew' },
};

// Sea enemies.
export const SEA_FOES = {
  merchant: { name: 'Merchant Sloop', cls: 'sloop', faction: 'merchant', hp: 85, guns: 2, dmg: 5, crew: ['brigand', 'brigand', 'marksman'], gold: [70, 150], goods: 6, xp: 30, flee: true },
  pirate: { name: 'Bloodwater Sloop', cls: 'sloop', faction: 'pirate', hp: 105, guns: 3, dmg: 6, crew: ['brigand', 'brigand', 'brigand', 'marksman'], gold: [50, 120], goods: 3, xp: 45 },
  pirate2: { name: 'Bloodwater Brig', cls: 'brig', faction: 'pirate', hp: 200, guns: 5, dmg: 7, crew: ['brigand', 'brigand', 'marksman', 'brute', 'captain'], gold: [140, 280], goods: 6, xp: 95, level: 3 },
  navy: { name: 'Navy Brig', cls: 'brig', faction: 'navy', hp: 230, guns: 5, dmg: 7, crew: ['soldier', 'soldier', 'soldier', 'marksman', 'captain'], gold: [120, 240], goods: 4, xp: 110 },
  navy2: { name: 'Navy Frigate', cls: 'frigate', faction: 'navy', hp: 380, guns: 8, dmg: 8, crew: ['soldier', 'soldier', 'soldier', 'marksman', 'marksman', 'brute', 'captain'], gold: [260, 480], goods: 8, xp: 220, level: 6 },
  ghost: { name: 'The Drowned Queen', cls: 'frigate', faction: 'ghost', hp: 560, guns: 7, dmg: 9, crew: ['skeleton', 'skeleton', 'skeleton', 'skeleton', 'skeleton', 'brute', 'captain'], gold: [900, 1200], goods: 0, xp: 500, boss: true },
};

export const RANKS = ['Deckhand', 'Swab', 'Cutthroat', 'Buccaneer', 'Corsair', 'Reaver', 'Sea Wolf', 'Captain', 'Dread Captain', 'Scourge', 'Pirate Lord'];
export const xpFor = (level) => Math.round(90 * Math.pow(level, 1.55));

// The story chain. Each step has one objective; finishing it pays out and starts the next.
export const STORY = [
  { title: 'A Ship of Your Own', text: 'You won a leaky sloop at cards. Find Mara at the Saltmere tavern. She always has work.', obj: { type: 'talk', npc: 'saltmere:tavern' }, mark: 'saltmere', reward: { gold: 60, xp: 30 } },
  { title: 'First Blood', text: 'Bloodwater sloops are picking off traders near Saltmere. Sink or board one. Red sails; line up your broadside and fire.', obj: { type: 'sink', faction: 'pirate', n: 1 }, reward: { gold: 150, xp: 80 } },
  { title: "Dead Men's Gold", text: 'The sloop carried a chart: something is buried on Gull Rock, north-west of Saltmere. Go ashore, find the mark, and dig.', obj: { type: 'dig', island: 'gull' }, give: { map: { island: 'gull', spot: 0, tier: 1 } }, mark: 'gull', reward: { gold: 100, xp: 90, timber: 30, iron: 10 } },
  { title: 'A Place to Hide', text: "Gold needs a home. Sail north-east to the cove at Rogue's Rest and raise a Lumber Camp.", obj: { type: 'build', building: 'lumber' }, mark: 'rest', reward: { gold: 150, xp: 100, timber: 20 } },
  { title: 'The Sugar Run', text: 'Honest pay, for once. Carry this sugar west to the tavern at Port Regal. Keep your guns quiet near the navy.', obj: { type: 'deliver', good: 'sugar', n: 8, to: 'regal' }, give: { quest: 8 }, mark: 'regal', reward: { gold: 320, xp: 130 } },
  { title: 'The Isle of Bones', text: 'A scholar in Port Regal pays for proof the dead walk. Put six of them back in the ground on the Isle of Bones.', obj: { type: 'kill', foe: 'skeleton', n: 6 }, mark: 'bones', reward: { gold: 380, xp: 220, iron: 30 } },
  { title: 'Bloodwater', text: 'Time to hit the gang where they live. Storm Bloodwater Hold and break open their vault.', obj: { type: 'raid', island: 'blood' }, mark: 'blood', reward: { gold: 500, xp: 320 } },
  { title: 'King of the Key', text: 'Fishermen will not go near Crabclaw Key. Something huge nests there. Kill it.', obj: { type: 'boss', boss: 'crabking' }, mark: 'crab', reward: { gold: 600, xp: 380, iron: 40 } },
  { title: 'The Drowned Queen', text: 'A ghost frigate sails the fog of the Drowned Reach, far to the south. Send her down a second time.', obj: { type: 'boss', boss: 'ghost' }, mark: 'reach', reward: { gold: 1500, xp: 700 } },
  { title: 'What Sleeps Below', text: 'The charts mark deep water in the north-west as The Maw. Ships go in. Arms come up. End it.', obj: { type: 'boss', boss: 'kraken' }, mark: 'maw', reward: { gold: 3000, xp: 1200 } },
  { title: 'Scourge of the Reach', text: 'The sea is yours, Captain. Take jobs, grow the cove, and keep your powder dry. More waters are coming.', obj: { type: 'none' }, reward: {} },
];

// Captain's appearance (cosmetic only) and companion animals.
export const LOOK_OPTS = {
  coat: { navy: 0x2a3f55, oxblood: 0x6b2420, forest: 0x2f4a38, pitch: 0x26282b, bone: 0xb9ae94, plum: 0x4a2f4a },
  sash: { red: 0x8a2a22, gold: 0xb58a2e, teal: 0x2f6f73, white: 0xcfc7b0 },
  hat: { tricorn: 'Tricorn', bandana: 'Bandana', wide: 'Wide brim', none: 'Bare head' },
  skin: [0xb98a66, 0x8f6547, 0xc79b78, 0x6e4a35],
};
export const PETS = {
  dog: { name: "Ship's Dog", perk: 'Bites the foe you are fighting and sniffs out buried treasure.', how: 'Mara at the Saltmere tavern will part with a stray for 250 gold.', price: 250, port: 'saltmere' },
  cat: { name: "Ship's Cat", perk: 'Lucky. 15% more gold from everything you plunder.', how: 'One-Eye Sal at the Black Shoals tavern sells a mouser for 450 gold.', price: 450, port: 'shoals' },
  parrot: { name: 'Parrot', perk: 'Swoops at foes to stagger them, and spots ships and salvage from farther off.', how: 'Something bright nests by the idol on the Isle of Bones.' },
};
