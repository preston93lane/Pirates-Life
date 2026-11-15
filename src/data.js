// All tunable game content lives here: the archipelago, ships, weapons, goods, enemies, story.

export const WORLD_R = 1450;

// kind: town | hideout | fort | ruins | crab | islet.   land: compass angle (radians) of the landing beach.
export const ISLANDS = [
  { cave: true, id: 'saltmere', name: 'Saltmere', x: 0, z: 0, r: 190, h: 26, seed: 11, kind: 'town', land: 2.5, blurb: 'Free port. Every service a captain needs.' },
  { jungle: true, id: 'rest', name: "Rogue's Rest", x: -520, z: 400, r: 135, h: 20, seed: 23, kind: 'hideout', land: 0.9, blurb: 'Your hidden cove.' },
  { id: 'gull', name: 'Gull Rock', x: 340, z: 350, r: 72, h: 12, seed: 37, kind: 'islet', land: 4.0, blurb: 'A bare islet. Good for burying things.' },
  { cave: true, jungle: true, id: 'regal', name: 'Port Regal', x: 840, z: -420, r: 205, h: 30, seed: 41, kind: 'town', land: 3.6, blurb: 'Navy trade port. Pays well for luxuries.' },
  { id: 'shoals', name: 'Black Shoals', x: -780, z: -560, r: 160, h: 22, seed: 53, kind: 'town', land: 0.4, blurb: "Smugglers' den. No questions asked." },
  { cave: true, jungle: true, id: 'bones', name: 'Isle of Bones', x: 250, z: -830, r: 195, h: 34, seed: 67, kind: 'ruins', land: 1.3, blurb: 'Old ruins. The dead here do not rest.' },
  { cave: true, id: 'crab', name: 'Crabclaw Key', x: -230, z: 900, r: 150, h: 14, seed: 71, kind: 'crab', land: 5.2, blurb: 'Crab nests, and something bigger.' },
  { cave: true, id: 'blood', name: 'Bloodwater Hold', x: 780, z: 640, r: 150, h: 18, seed: 83, kind: 'fort', land: 3.9, blurb: 'Fort of the Bloodwater gang. Their vault is full.' },
  { cave: true, id: 'tooth', name: "Widow's Tooth", x: -1020, z: 170, r: 66, h: 16, seed: 97, kind: 'islet', land: 0.2, blurb: 'A lonely spike of rock.' },
];
export const ISLAND = Object.fromEntries(ISLANDS.map((i) => [i.id, i]));

export const ZONES = {
  reach: { name: 'The Drowned Reach', x: -380, z: -1120, r: 260 },
  maw: { name: 'The Maw', x: 1130, z: 1010, r: 200 },
  trident: { name: "Poseidon's Throne", x: -900, z: 760, r: 190 },
};

// Twelve hulls. Upgrades are a percentage of these numbers, so a small ship never catches a big one.
// rig: square | gaff | lateen. fat = full cargo hull. sharp = fine fast bow. castle / fore = stern and bow castles.
export const SHIP_CLASSES = {
  cutter: { name: 'Cutter', role: 'Starter', len: 17, beam: 5.4, masts: 1, rig: 'gaff', castle: 0.7, guns: 2, hp: 90, speed: 15, turn: 0.7, cargo: 14, crew: 1, price: 0, level: 1, hullC: 0x4d3c29, trimC: 0x6f5a3c },
  sloop: { name: 'Sloop', role: 'Fast', len: 21, beam: 6.4, masts: 1, guns: 3, hp: 125, speed: 17, turn: 0.64, cargo: 18, crew: 2, price: 900, level: 2, hullC: 0x40301f, trimC: 0x9a772f },
  fluyt: { name: 'Fluyt', role: 'Cargo', len: 25, beam: 9, fat: 1, masts: 2, castle: 2, guns: 3, hp: 180, speed: 12.5, turn: 0.46, cargo: 56, crew: 2, price: 1700, level: 3, hullC: 0x5f4a34, trimC: 0xb9a77c },
  brig: { name: 'Brig', role: 'Strong', len: 28, beam: 8.2, masts: 2, guns: 5, hp: 235, speed: 14, turn: 0.5, cargo: 34, crew: 3, price: 2600, level: 4, hullC: 0x33291f, trimC: 0x8a2a22 },
  schooner: { name: 'Schooner', role: 'Fast', len: 28, beam: 6.8, sharp: true, masts: 2, rig: 'gaff', rake: 0.1, guns: 4, hp: 175, speed: 19.5, turn: 0.62, cargo: 26, crew: 2, price: 3400, level: 5, hullC: 0x1f2c33, trimC: 0xcfc7b0 },
  xebec: { name: 'Xebec', role: 'Fast and strong', len: 31, beam: 7.6, sharp: true, masts: 3, rig: 'lateen', beak: true, guns: 6, hp: 245, speed: 18, turn: 0.6, cargo: 30, crew: 3, price: 5200, level: 6, hullC: 0x5a3a24, trimC: 0x2f6f73 },
  brigantine: { name: 'Brigantine', role: 'All-rounder', len: 31, beam: 8.6, masts: 2, tall: 1.06, guns: 6, hp: 300, speed: 15.5, turn: 0.5, cargo: 46, crew: 3, price: 5800, level: 6, hullC: 0x3a3028, trimC: 0xb58a2e },
  galleon: { name: 'Galleon', role: 'Cargo and strong', len: 35, beam: 10.6, fat: 0.7, masts: 3, castle: 3.2, fore: 1.6, gild: true, guns: 7, hp: 410, speed: 12, turn: 0.4, cargo: 92, crew: 4, price: 8200, level: 7, hullC: 0x4a3020, trimC: 0x8a2a22, band: 0x6b4a2c },
  frigate: { name: 'Frigate', role: 'Strong', len: 37, beam: 9.6, masts: 3, guns: 8, hp: 430, speed: 15, turn: 0.44, cargo: 50, crew: 4, price: 9800, level: 8, hullC: 0x25221f, trimC: 0x25221f, band: 0xc9a94a },
  clipper: { name: 'Clipper', role: 'Fastest', len: 40, beam: 8, sharp: true, masts: 3, tall: 1.12, rake: 0.05, guns: 6, hp: 310, speed: 21.5, turn: 0.5, cargo: 46, crew: 3, price: 12500, level: 9, hullC: 0x12222a, trimC: 0xd9cdb0, bottom: 0x4f7f6e },
  indiaman: { name: 'East Indiaman', role: 'Biggest hold', len: 41, beam: 11.8, fat: 1, masts: 3, castle: 3, fore: 1.4, gild: true, guns: 8, hp: 540, speed: 12.5, turn: 0.38, cargo: 140, crew: 5, price: 15500, level: 9, hullC: 0x3a2a1c, trimC: 0x27406b, band: 0xcfc7b0 },
  manowar: { name: "Man-o'-War", role: 'Strongest', len: 45, beam: 12, decks: 2, masts: 3, tall: 1.05, castle: 3.4, fore: 1.5, gild: true, guns: 12, hp: 740, speed: 13, turn: 0.36, cargo: 70, crew: 6, price: 22000, level: 10, hullC: 0x1e1b19, trimC: 0x7d1f1a, band: 0xc9a94a },
};

// Each track has 5 levels. cost(level) = base * (level+1)^1.5
export const SHIP_UPGRADES = {
  hull: { name: 'Hull plating', desc: '+18% hull strength', gold: 150, timber: 12, iron: 4 },
  sails: { name: 'Sailcloth', desc: '+5% speed and turning', gold: 130, timber: 6, iron: 0 },
  cannons: { name: 'Gun deck', desc: '+15% damage, faster reload', gold: 180, timber: 4, iron: 12 },
  hold: { name: 'Cargo hold', desc: '+25% cargo space', gold: 110, timber: 14, iron: 0 },
  crew: { name: 'Crew berths', desc: '+1 berth for a hired hand', gold: 160, timber: 8, iron: 4 },
  brig: { name: 'Brig cells', desc: 'Holds one more prisoner for ransom', gold: 220, timber: 10, iron: 14 },
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
  quarters: { name: 'Crew Quarters', desc: 'More berths, so you can hire more hands.', gold: 300, timber: 30, iron: 6, fx: (l) => `+${l} crew berths` },
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
  warden: { name: 'Bone Warden', hp: 300, dmg: 22, speed: 3.2, tele: 0.9, look: 'skeleton', heavy: true, scale: 1.6, mini: true, xp: 150, gold: [120, 220] },
  chief: { name: 'Bandit Chief', hp: 260, dmg: 18, speed: 4.0, tele: 0.5, look: 'captain', scale: 1.2, mini: true, xp: 130, gold: [120, 200] },
  matriarch: { name: 'Crab Matriarch', hp: 280, dmg: 18, speed: 3.8, tele: 0.7, look: 'crab', heavy: true, scale: 2, mini: true, xp: 140, gold: [80, 160] },
  crew: { name: 'Crewmate', hp: 70, dmg: 11, speed: 4.0, tele: 0.5, look: 'crew' },
  h_bravo: { name: 'Swordmaster', hp: 95, dmg: 21, speed: 4.8, tele: 0.4, look: 'bravo' },
  h_musket: { name: 'Musketeer', hp: 60, dmg: 19, speed: 4.0, tele: 0.8, look: 'musketeer', ranged: true },
  h_bruiser: { name: 'Bruiser', hp: 190, dmg: 17, speed: 3.5, tele: 0.6, look: 'bruiser', scale: 1.12 },
};

// Sea enemies.
export const SEA_FOES = {
  merchant: { name: 'Merchant Fluyt', cls: 'fluyt', faction: 'merchant', hp: 85, guns: 2, dmg: 5, crew: ['brigand', 'brigand', 'marksman'], gold: [70, 150], goods: 6, xp: 30, flee: true },
  pirate: { name: 'Bloodwater Sloop', cls: 'sloop', faction: 'pirate', hp: 105, guns: 3, dmg: 6, crew: ['brigand', 'brigand', 'brigand', 'marksman'], gold: [50, 120], goods: 3, xp: 45 },
  pirate2: { name: 'Bloodwater Brig', cls: 'brig', faction: 'pirate', hp: 200, guns: 5, dmg: 7, crew: ['brigand', 'brigand', 'marksman', 'brute', 'captain'], gold: [140, 280], goods: 6, xp: 95, level: 3 },
  navy: { name: 'Navy Brig', cls: 'brig', faction: 'navy', hp: 230, guns: 5, dmg: 7, crew: ['soldier', 'soldier', 'soldier', 'marksman', 'captain'], gold: [120, 240], goods: 4, xp: 110 },
  navy2: { name: 'Navy Frigate', cls: 'frigate', faction: 'navy', hp: 380, guns: 8, dmg: 8, crew: ['soldier', 'soldier', 'soldier', 'marksman', 'marksman', 'brute', 'captain'], gold: [260, 480], goods: 8, xp: 220, level: 6 },
  hunter: { name: 'Navy Hunter', cls: 'manowar', faction: 'navy', hp: 560, guns: 9, dmg: 10, crew: ['soldier', 'soldier', 'soldier', 'soldier', 'marksman', 'marksman', 'brute', 'captain'], gold: [400, 650], goods: 6, xp: 320 },
  ghost: { name: 'The Drowned Queen', cls: 'galleon', faction: 'ghost', hp: 560, guns: 7, dmg: 9, crew: ['skeleton', 'skeleton', 'skeleton', 'skeleton', 'skeleton', 'brute', 'captain'], gold: [900, 1200], goods: 0, xp: 500, boss: true },
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
  { title: 'Strike Your Colours', text: 'Fear is cheaper than powder. Break a crew\'s nerve until they haul down their flag: fire shot and your own black flag both help.', obj: { type: 'yield' }, reward: { gold: 500, xp: 300 } },
  { title: 'A Name on a Poster', text: 'Every tavern keeps a bounty board of captains worse than you. Take a poster, hunt the name on it, and collect.', obj: { type: 'bounty' }, reward: { gold: 800, xp: 400 } },
  { title: 'Scourge of the Reach', text: 'The sea is yours, Captain. Bounties grow harder each time they return, daily orders change every morning, and your deeds are still unwritten.', obj: { type: 'none' }, reward: {} },
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

// Who rules what. Standing runs from -100 to 100; at -20 or below a faction attacks on sight.
export const FACTIONS = {
  navy: { name: 'Royal Navy', port: 'regal', blurb: 'Holds Port Regal and patrols the trade lanes. Attack merchants or navy ships and they hunt you. Sink Bloodwater ships, take navy jobs, hand over Bloodwater prisoners, or pay a bribe to cool them down.' },
  guild: { name: 'Merchant Guild', port: 'saltmere', blurb: 'Runs Saltmere and the merchant sloops. Rob them and Saltmere stops giving you work. Deliveries and killing Bloodwater raiders win them back.' },
  smug: { name: 'Shoals Smugglers', port: 'shoals', blurb: 'The crews of Black Shoals. They like anyone who hurts the navy and brings them goods or navy prisoners.' },
  blood: { name: 'Bloodwater Gang', port: 'blood', blurb: 'Red-sailed raiders. Hostile from the start. Smuggler work and ransoming navy officers to them can earn a truce.' },
};
export const SHIP_FACTION = { merchant: 'guild', navy: 'navy', pirate: 'blood' };
export const PORT_FACTION = { saltmere: 'guild', regal: 'navy', shoals: 'smug' };
export const AMMO = {
  round: { name: 'Round shot', short: 'ROUND', desc: 'Solid iron. The most hull damage.' },
  chain: { name: 'Chain shot', short: 'CHAIN', desc: 'Tears sails and rigging so a ship cannot run or turn. Little hull damage.', gold: 450, iron: 20 },
  fire: { name: 'Fire shot', short: 'FLAME', desc: 'Heated shot. Sets the deck ablaze: the hull burns over time and the crew lose their nerve.', gold: 900, iron: 35 },
  grapple: { name: 'Grappling hooks', short: 'HOOKS', desc: 'Hook a damaged ship from range and haul her in to board, while she still has fight left.', gold: 600, iron: 30 },
};
export const SWIVEL = { name: 'Swivel gun', desc: 'A gun you aim yourself, in any direction. Drag to look: it fires where the ring sits on the water.', gold: 700, iron: 40 };
export const FLAGS = { pirate: 'Your own colours', merchant: 'Merchant Guild', navy: 'Royal Navy', bloodwater: 'Bloodwater' };
export const JOLLY = { field: { black: '#141414', blood: '#7d1f1a', sea: '#1f4a4f', bone: '#d9cdb0' }, emblem: { skull: 'Skull and bones', swords: 'Crossed blades', hourglass: 'Hourglass', crown: 'Broken crown' } };
export const RANSOM = { merchant: 150, pirate: 120, pirate2: 260, navy: 300, navy2: 520, hunter: 800 };
export const FOG_N = 28;

// ----- things that bring a captain back -----
// Daily orders: three are drawn each real day.
export const DAILY = [
  { id: 'sink', evt: 'sink', n: [2, 3], text: (n) => `Sink, board or take ${n} ships` },
  { id: 'board', evt: 'board', n: [1, 1], text: () => 'Win a boarding fight' },
  { id: 'kill', evt: 'kill', n: [6, 10], text: (n) => `Defeat ${n} foes on foot` },
  { id: 'dig', evt: 'dig', n: [1, 1], text: () => 'Dig up a buried treasure' },
  { id: 'sell', evt: 'sell', n: [250, 500], step: 50, amount: true, text: (n) => `Sell ${n} gold worth of goods` },
  { id: 'chest', evt: 'chest', n: [2, 2], text: (n) => `Open ${n} chests` },
  { id: 'yield', evt: 'yield', n: [1, 1], text: () => 'Make a ship strike her colours' },
];
// Deeds: long goals with a reward each.
const st = (k) => (s) => s.stats[k] || 0, built = (s) => Object.values(s.base.b).reduce((x, y) => x + y, 0);
export const DEEDS = [
  { id: 'sunk10', name: 'Powder Monkey', text: 'Sink 10 ships', stat: st('sunk'), goal: 10, reward: { gold: 300, xp: 100 } },
  { id: 'sunk50', name: 'Terror of the Lanes', text: 'Sink 50 ships', stat: st('sunk'), goal: 50, reward: { gold: 2000, xp: 600 } },
  { id: 'board5', name: 'Boarder', text: 'Win 5 boarding fights', stat: st('boarded'), goal: 5, reward: { gold: 400, xp: 150 } },
  { id: 'board25', name: 'Deck Reaper', text: 'Win 25 boarding fights', stat: st('boarded'), goal: 25, reward: { gold: 2500, xp: 700 } },
  { id: 'yield5', name: 'Feared Name', text: 'Make 5 ships strike their colours', stat: st('yields'), goal: 5, reward: { gold: 600, xp: 200 } },
  { id: 'kills50', name: 'Blooded', text: 'Defeat 50 foes on foot', stat: st('kills'), goal: 50, reward: { gold: 400, xp: 150 } },
  { id: 'kills250', name: "Butcher's Bill", text: 'Defeat 250 foes on foot', stat: st('kills'), goal: 250, reward: { gold: 2000, xp: 600 } },
  { id: 'dug5', name: 'Gravedigger', text: 'Dig up 5 treasures', stat: st('dug'), goal: 5, reward: { gold: 500, xp: 200 } },
  { id: 'seen', name: 'Chartmaker', text: 'Discover every island', stat: (s) => Object.keys(s.seen).length, goal: 9, reward: { gold: 600, xp: 300 } },
  { id: 'base6', name: 'Landlord', text: 'Reach 6 building levels at your hideout', stat: built, goal: 6, reward: { gold: 500, timber: 60, iron: 40 } },
  { id: 'base18', name: 'Pirate Haven', text: 'Fully build your hideout', stat: built, goal: 18, reward: { gold: 4000, xp: 1000 } },
  { id: 'bounty3', name: 'Bounty Hunter', text: 'Collect 3 bounties', stat: st('bounties'), goal: 3, reward: { gold: 1500, xp: 500 } },
  { id: 'storm3', name: 'Storm Rider', text: 'Ride out 3 storms', stat: st('storms'), goal: 3, reward: { gold: 400, xp: 200 } },
  { id: 'ransom5', name: 'Ransomer', text: 'Ransom 5 captains', stat: st('ransomed'), goal: 5, reward: { gold: 800, xp: 250 } },
  { id: 'rank10', name: 'Pirate Lord', text: 'Reach rank 10', stat: (s) => s.level, goal: 10, reward: { gold: 5000 } },
];
// Bounties: named captains, each stronger than the last, and stronger again every time they return.
export const BOUNTIES = [
  { id: 'b_meg', captain: 'Red Meg Harrow', ship: 'Wicked Tide', cls: 'schooner', hp: 200, guns: 4, dmg: 8, level: 2, gold: 500, crew: ['brigand', 'brigand', 'marksman', 'captain'] },
  { id: 'b_crane', captain: 'Silas "Gallows" Crane', ship: "Hangman's Due", cls: 'brigantine', hp: 340, guns: 6, dmg: 9, level: 4, gold: 1100, crew: ['brigand', 'brigand', 'marksman', 'brute', 'captain'] },
  { id: 'b_vane', captain: 'Mother Vane', ship: 'Black Psalm', cls: 'xebec', hp: 460, guns: 7, dmg: 10, level: 6, gold: 1900, crew: ['brigand', 'brigand', 'marksman', 'marksman', 'brute', 'captain'] },
  { id: 'b_ash', captain: 'Ashdown the Turncoat', ship: 'Iron Tithe', cls: 'frigate', hp: 640, guns: 9, dmg: 11, level: 8, gold: 3200, crew: ['soldier', 'soldier', 'brigand', 'marksman', 'marksman', 'brute', 'captain'] },
  { id: 'b_nine', captain: 'Nine-Lives Okoro', ship: 'Last Laugh', cls: 'manowar', hp: 840, guns: 10, dmg: 12, level: 10, gold: 5000, crew: ['brigand', 'brigand', 'brigand', 'marksman', 'marksman', 'brute', 'brute', 'captain'] },
];
for (const b of BOUNTIES) { SEA_FOES[b.id] = { name: b.ship, cls: b.cls, faction: 'pirate', hp: b.hp, guns: b.guns, dmg: b.dmg, crew: b.crew, gold: [b.gold * 0.2, b.gold * 0.3], goods: 8, xp: Math.round(b.gold * 0.2), bounty: true }; RANSOM[b.id] = Math.round(b.gold * 0.4); }

// What lives in each island's cave.
export const CAVE_FOES = { bones: ['skeleton', 'skeleton', 'skeleton', 'skeleton', 'warden'], tooth: ['skeleton', 'skeleton', 'skeleton', 'warden'], saltmere: ['brigand', 'brigand', 'marksman', 'chief'], regal: ['brigand', 'brigand', 'marksman', 'chief'], blood: ['brigand', 'brigand', 'brigand', 'brute'], crab: ['crab', 'crab', 'crab', 'crab', 'matriarch'] };
export const BOMB = { name: 'Powder flask', desc: 'Throw it at a knot of enemies. It bursts on landing and hurts everything close.', gold: 45, max: 6 };

// ----- hired hands: each has a trade. Better grades cost more and do more. -----
const pc = (v) => Math.round(v * 100);
export const HANDS = {
  deckhand: { name: 'Deckhand', gold: 60, foe: 'crew', fight: 1, perk: () => 'A plain pair of hands. Fights well enough.' },
  gunner: { name: 'Gunner', gold: 200, foe: 'crew', fight: 0.8, dmg: 0.06, reload: 0.03, perk: (k) => `Cannons hit ${pc(0.06 * k)}% harder and load ${pc(0.03 * k)}% faster.` },
  rigger: { name: 'Rigger', gold: 190, foe: 'crew', fight: 0.8, speed: 0.035, perk: (k) => `Ship sails and turns ${pc(0.035 * k)}% faster.` },
  carpenter: { name: 'Carpenter', gold: 230, foe: 'crew', fight: 0.7, repair: 0.35, perk: (k) => `Mends the hull at sea, ${(0.35 * k).toFixed(1)} a second.` },
  surgeon: { name: 'Surgeon', gold: 300, foe: 'crew', fight: 0.6, heal: 0.3, perk: (k) => `Hands who fall have a ${pc(Math.min(0.85, 0.3 + 0.3 * k))}% chance to live. Rum heals you more.` },
  quarter: { name: 'Quartermaster', gold: 280, foe: 'crew', fight: 0.9, loot: 0.05, keep: 0.25, perk: (k) => `${pc(0.05 * k)}% more plunder. Morale falls slower.` },
  bravo: { name: 'Swordmaster', gold: 260, foe: 'h_bravo', fight: 1, land: true, perk: () => 'Quick and deadly with a blade. Best on raids and boarding.' },
  musketeer: { name: 'Musketeer', gold: 250, foe: 'h_musket', fight: 1, land: true, perk: () => 'Shoots from a distance on raids and boarding.' },
  bruiser: { name: 'Bruiser', gold: 290, foe: 'h_bruiser', fight: 1, land: true, perk: () => 'Huge and very hard to kill. Soaks up the blows.' },
};
export const GRADES = [{ name: 'Green', k: 1, cost: 1, fight: 0.85 }, { name: 'Able', k: 1.6, cost: 2.4, fight: 1.15 }, { name: 'Veteran', k: 2.4, cost: 5, fight: 1.5 }];
export const HAND_NAMES = ['Tom', 'Jack', 'Ned', 'Will', 'Sam', 'Bess', 'Moll', 'Anne', 'Kit', 'Abe', 'Finn', 'Joss', 'Cora', 'Dirk', 'Hale', 'Mags', 'Ruth', 'Pike', 'Obed', 'Nell'];
export const HAND_NICK = ['One-Eye', 'Red', 'Long', 'Mad', 'Lucky', 'Black', 'Old', 'Salt', 'Quick', 'Stump', 'Iron', 'Silent'];
// where the captain puts the crew
export const STATIONS = {
  even: { name: 'All stations even', desc: 'No bonus, no cost.', speed: 1, reload: 1, repair: 0 },
  sails: { name: 'All hands to the sails', desc: '+15% speed. Guns load 30% slower.', speed: 1.15, reload: 1.3, repair: 0 },
  guns: { name: 'Man the guns', desc: 'Guns load 25% faster. 12% slower ship.', speed: 0.88, reload: 0.75, repair: 0 },
  repair: { name: 'Damage parties', desc: 'Crew patch the hull and fight fires. Slower ship and guns.', speed: 0.85, reload: 1.3, repair: 0.005 },
};

// how many hands each hull can carry
const BERTHS = { cutter: 3, sloop: 4, fluyt: 5, brig: 6, schooner: 6, xebec: 8, brigantine: 8, galleon: 10, frigate: 11, clipper: 9, indiaman: 12, manowar: 16 };
for (const k in BERTHS) SHIP_CLASSES[k].berths = BERTHS[k];
// a ghost ship that only sails by night
SEA_FOES.phantom = { name: 'The Pale Lantern', cls: 'brig', faction: 'ghost', hp: 250, guns: 5, dmg: 7, crew: ['skeleton', 'skeleton', 'skeleton', 'skeleton', 'captain'], gold: [320, 480], goods: 2, xp: 170 };
// special shot is bought by the keg once the guns are fitted for it
export const AMMO_PACK = { chain: { n: 20, gold: 60 }, fire: { n: 20, gold: 90 }, grapple: { n: 10, gold: 40 } };
// ----- captain's skills: every rank gives the same small bonus; feats are bought once -----
export const SKILLS = {
  sword: { name: 'Swordsmanship', per: '+6% blade damage', max: 5 },
  marks: { name: 'Marksmanship', per: '+8% pistol damage, 4% faster reload', max: 5 },
  tough: { name: 'Toughness', per: '+10 health', max: 5 },
  gunnery: { name: 'Gunnery', per: '+4% cannon damage', max: 5 },
  seaman: { name: 'Seamanship', per: '+2.5% ship speed and turning', max: 5 },
  lead: { name: 'Leadership', per: 'Morale falls 8% slower; +1 berth every 2 ranks', max: 5 },
  plunder: { name: 'Plunder', per: '+4% gold from ships', max: 5 },
};
export const FEAT_COST = 3;
export const FEATS = {
  whirl: { name: 'Storm of Steel', req: 'sword', desc: 'WHIRL is ready again in 4 seconds instead of 7.' },
  twin: { name: 'Brace of Pistols', req: 'marks', desc: 'You draw a second pistol: every shot hits 70% harder.' },
  wind: { name: 'Second Wind', req: 'tough', desc: 'Once every three minutes, a killing blow leaves you standing at 40% health.' },
  hot: { name: 'Hot Shot', req: 'gunnery', desc: 'Round shot has a 15% chance to set the enemy deck ablaze.' },
  hull: { name: 'Clean Hull', req: 'seaman', desc: 'Your ship turns 15% faster.' },
  born: { name: 'Born Leader', req: 'lead', desc: '+2 berths, and a fourth hand may come ashore with you.' },
  powder: { name: 'Powder Hand', req: 'plunder', desc: 'Powder flasks hit 30% harder and you can carry 9.' },
};
// food, water and limes: what a hand uses, and what a full store is, per head
export const STORES = { food: { name: 'Salt pork and biscuit', gold: 2, per: 12 }, water: { name: 'Fresh water', gold: 1, per: 12 }, limes: { name: 'Limes', gold: 4, per: 6 } };
