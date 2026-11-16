# Pirate's Life — Game Design Plan

*Working title. Before public launch we need a distinctive, trademark-clear name
(candidates: **Saltmere**, **Blackwater Reach**, **Rogue Tide**, **Cutthroat Seas**).*

---

## 1. Vision

An open-sea pirate adventure for phones. You captain one ship, sail a hand-built
archipelago, fight broadside-to-broadside, board enemy decks with sword and
flintlock, walk ashore to explore islands, and haul what you win back to a
hideout you build yourself. Later, other players sail the same waters, and your
hideout is something they can raid.

**One-line pitch:** *Sail, board, plunder, build, and defend what you stole.*

**Session shape:** 3–10 minutes for one meaningful thing (a delivery, a ship
taken, a treasure dug), 30+ minutes when the player wants it.

### Design pillars

1. **One world, no menus between you and it.** Sea, deck and island are the
   same space. You drop anchor and walk up the beach; you grapple a ship and
   jump the rail.
2. **Readable skill, thumb-sized.** Sea combat is about positioning your
   broadside. Sword combat is about timing: parry, dodge, strike. Two thumbs,
   no finger gymnastics.
3. **Everything you earn is physical.** Loot is cargo in a hold and gold in a
   vault. It can be carried, delivered, sunk, buried and (later) stolen.
4. **Grit over gloss.** Weathered timber, tar, gun smoke and lantern light.
   Stylized, never cute.

---

## 2. Core loop

```
        ┌────────────► TOWN: take jobs, sell cargo, upgrade ◄──────────┐
        │                                                              │
   SAIL OUT ──► find ships / islands / wrecks ──► FIGHT or EXPLORE ──► HAUL LOOT
        │                                                              │
        └────────────► HIDEOUT: build, produce, store, defend ◄────────┘
```

- **Minute to minute:** steer, line up a broadside, parry a blade, open a chest.
- **Session to session:** finish a job, afford the next upgrade, add a building.
- **Week to week:** bigger ship class, legendary weapons, boss monsters, and
  (multiplayer phases) climbing raid leagues and crew wars.

---

## 3. Game systems

### 3.1 Sailing and exploration
- Open archipelago with ports, wild islands, a rival fort, and boss waters.
- Left thumb steers; a sail control sets speed (furled / half / full).
- Fog-of-war chart: islands are inked onto your map as you discover them.
- Things to find at sea: merchant convoys, rival pirates, navy patrols,
  floating wreckage and bottles (treasure maps), storms, monster waters.
- *Later:* wind direction that rewards good sailing, weather fronts, day/night.

### 3.2 Ship battles
- Broadside cannons, one battery per side, each reloading on its own.
- One FIRE button: fires the side that bears on the enemy. Aim assist handles
  elevation; **the player's job is angle and range.**
- Enemy types: **Merchants** (run, rich cargo), **Rival pirates** (aggressive),
  **Navy** (hunts you when you are Wanted), **Ghost ship** (boss).
- Sinking a ship leaves floating salvage. Crippling it lets you **board** for
  the whole cargo.
- *Later:* chain shot (sails), grapeshot (crew), fire barrels, ramming prows.

### 3.3 Boarding, swords and firearms
- When an enemy hull is broken and you are alongside: **BOARD**. The ships
  grapple together and the fight moves to the decks, your crew beside you.
- **Sword:** three-hit combo; hold to **block**; block at the last moment to
  **parry** and stagger; **dodge-roll** through heavy attacks.
- **Firearms:** a flintlock is one powerful shot on a long reload. It opens a
  fight or finishes one. Muskets and blunderbusses are upgrades with different
  range and spread.
- Enemies telegraph: brigands (parry them), marksmen (dodge the shot), brutes
  (unblockable — roll away), captains (mix of all three).
- The same combat is used ashore against bandits and monsters.

### 3.4 Island exploration
- Drop anchor near any island and walk it in third person.
- Chests in hard-to-see places, ruins guarded by the cursed dead, crab nests,
  and **buried treasure**: maps show an island and a mark, you find the spot
  and dig.
- *Later:* caves and interiors, climbing, traps and puzzles, rare flora for
  crafting.

### 3.5 Towns, jobs and trade
- Ports have a **Tavern** (story + job board, rum, rumours), **Shipwright**
  (repair, upgrades, new ships), **Blacksmith** (blades and guns) and
  **Market** (trade goods with prices that differ per port).
- Job types: deliver cargo, hunt ships, recover treasure, clear a monster
  nest, raid a fort, escort (later), smuggle past the navy (later).
- A short **story chain** teaches every system in order and ends at the first
  boss monsters.
- **Wanted level:** attacking merchants and navy raises it; the navy hunts you
  until it cools down or you pay it off.

### 3.6 Hideout (base building)
- You own a hidden cove. Build and upgrade on its plots:

| Building | What it does |
|---|---|
| Storehouse / Vault | Protects a share of your gold from loss (and from raiders later) |
| Lumber camp | Produces timber over real time |
| Iron mine | Produces iron over real time |
| Distillery | Produces gold income over real time |
| Crew quarters | More fighters at your side when boarding |
| Gun battery | Defence rating (matters once raids exist) |

- Production continues while you are away (capped), which gives a reason to
  come back each day without forcing it.
- *Later:* free placement of walls, towers and traps; decoration; a dock that
  shows off your fleet.

### 3.7 Upgrades and progression
- **Ship classes:** Sloop → Brig → Frigate (later: Galleon, Man-o'-war,
  specialist hulls). Each class has upgrade tracks: hull, sails, cannons,
  hold, crew.
- **Weapons:** blade tiers and firearm tiers, bought with gold and iron;
  legendary weapons only from bosses and deep treasure.
- **Infamy** (XP) raises your rank, unlocking ship classes, jobs and regions.

### 3.8 Monsters
- **Ashore:** the cursed dead (skeleton crews in ruins), giant crabs, and a
  Crab King boss.
- **At sea:** the ghost ship *Drowned Queen*; the **Kraken**, whose arms rise
  around your ship and must be shot down before they break your hull.
- *Later:* sea serpents, sirens, a volcanic island, world-boss events all
  players on a server fight together.

### 3.9 Your captain, companions and sea events
- **Captain's look:** coat, sash, skin tone and hat are chosen in the log and
  can be changed any time. Sailcloth colour is chosen at a shipwright. These
  are the cosmetic slots the store will fill later (outfits, hats, emblems).
- **Companions:** one animal sails with you. Each is *found*, not just bought,
  and each changes how you play:

| Companion | How you get it | What it does |
|---|---|---|
| Ship's Dog | Bought from the Saltmere tavern | Bites the foe you are fighting; runs to buried treasure when you hold the map |
| Ship's Cat | Bought in Black Shoals | Luck: 15% more gold from all plunder |
| Parrot | Found at the idol on the Isle of Bones | Swoops to stagger foes; spots ships and salvage from farther away |

  *Later:* monkey (steals from enemies), more breeds and colours as cosmetics,
  companion levels, companions as rare event rewards.
- **Events at sea** interrupt a quiet crossing and reward a correct response:

| Event | What happens | What the player does |
|---|---|---|
| Storm | Sky blackens, swell triples, lightning, the helm wanders | Reef sails, or the rigging tears and the hull takes damage |
| Siren's call | A song drags the helm toward rocks | Fire the guns to drown it out, or shell the rocks for pearls |
| Kraken attack | Arms rise and hold the ship | Shoot every arm before the hull breaks |

  *Later:* whirlpools, fog banks with wreck salvage, merchant convoys under
  escort, becalmed doldrums, treasure fleets announced server-wide.

### 3.10 Shot, prizes, flags and factions
- **Shot types** (bought at a shipwright, switched at sea): round shot for hull
  damage, chain shot to cripple sails, fire shot to burn the hull and break
  morale, grappling hooks to haul in and board a ship that still has fight left.
- **Swivel gun:** a purchasable gun the player aims by looking; a ring on the
  water shows where it lands. The broadside stays the main weapon.
- **How you take a ship decides what you get:**

| Outcome | Loot | Infamy | Reputation cost |
|---|---|---|---|
| Sink her | About a third, as floating salvage | Most (x1.5) | Worst |
| Board and win | All of it, plus her flag and a prisoner | Some (x0.8) | Bad |
| She surrenders, you spare her | Most (80%), plus her flag | Least (x0.5) | Mildest |

- **Surrender:** every crew has morale. Hull damage, fire, a bigger ship than
  theirs and your own black flag wear it down; when it breaks she strikes her
  colours and you choose: spare, take the captain too, or sink her anyway.
- **Prisoners:** a brig (ship upgrade, one cell per level) holds captured
  captains. Taverns ransom them; Port Regal pays in navy favour for Bloodwater
  captains, Black Shoals pays extra for navy officers.
- **Flags:** board a faction's ship to keep its colours. Flying them fools that
  faction until a ship gets close, and firing gives you away. Your own flag
  (field and emblem are customizable) pays 25% more infamy and scares crews.
- **Factions:** Royal Navy, Merchant Guild, Shoals Smugglers, Bloodwater Gang.
  Standing runs -100 to 100. At Hostile a faction attacks on sight and its port
  stops giving jobs; at Hunted the navy sends hunters that outgun you. Standing
  is repaired by that faction's jobs, by sinking their enemies, by handing over
  prisoners, or by bribing a clerk.
- **Chart:** tap the compass for a full-screen map with pan and pinch-zoom,
  fog over waters you have not sailed, named islands, a legend, moving storms,
  marked dangerous waters, and tap-for-details with a "set course" marker.

### 3.11 Stealing from players and raiding bases (multiplayer design)
Built in two stages so the game is fun before it needs a big server bill.

1. **Asynchronous raids (first).** You attack a snapshot of another player's
   hideout, defended by their buildings and AI crew. You steal a capped share
   of their *unprotected* loot. They get a replay and a **revenge** raid.
   Shields after being raided, league matchmaking, and vaults keep losses fair.
   This is the cheapest PvP to run and the easiest to make clip-worthy.
2. **Shared seas (second).** 20–40 players per sea instance. PvP is opt-in by
   *where you sail*: safe waters near ports, lawless waters with the best
   loot. Sinking a player spills part of the cargo they are carrying, never
   their stored wealth. Crews (guilds), crew wars, bounties on notorious
   players.

Anti-frustration rules: you only ever risk what you chose to carry or left
unvaulted; new players are shielded; no losing ships permanently.

---

## 4. The world (v1 archipelago)

| Place | Role |
|---|---|
| **Saltmere** | Starting free port. All services. |
| **Rogue's Rest** | Your hideout cove. |
| **Port Regal** | Navy trade port. Best prices for luxury goods, hostile when Wanted. |
| **Black Shoals** | Smugglers' den. Buys anything, sells powder cheap. |
| **Isle of Bones** | Jungle ruins, cursed dead, idol treasure. |
| **Crabclaw Key** | Crab nests and the Crab King. |
| **Bloodwater Hold** | Rival pirate fort. Raidable; resets over time. |
| **Gull Rock, Widow's Tooth** | Small islets for buried treasure. |
| **The Drowned Reach** | Fog-bound water where the ghost ship sails. |
| **The Maw** | Deep water. The Kraken. |

---

## 5. Art and audio direction

**Look:** *weathered low-poly.* Flat-shaded, hand-chosen colours, no outlines,
no cartoon faces, real proportions. Think an oil painting simplified into
facets: tar-black hulls, sun-bleached canvas, teal-grey water, warm low sun,
gun smoke that hangs. Readable on a small screen, cheap to render on a phone,
and distinctive in a 3-second video clip.

- **Palette:** deep teal sea, bone canvas, tar and oak browns, brass and
  lantern-orange for UI accents, blood red reserved for danger.
- **Characters:** faceless but well-proportioned figures; identity comes from
  silhouette (tricorn, long coat, bandana, bone) and movement.
- **UI:** dark leather and brass with parchment for charts. Engraved serif
  type. Big thumb targets, no clutter while sailing.
- **Audio:** cannon thump, timber crack, steel on steel, surf; restrained
  music (hurdy-gurdy / fiddle motifs) that swells only in battle.

---

## 6. Controls (phone, landscape; portrait supported)

| | Left thumb | Right thumb |
|---|---|---|
| **At sea** | Joystick: steer | FIRE, sails up/down, BOARD / GO ASHORE when available |
| **On foot** | Joystick: move | ATTACK, BLOCK (hold), DODGE, SHOOT, RUM, context button |
| **Both** | — | Drag empty screen to look around |

Keyboard and mouse work too (WASD, Space, Shift, etc.) for desktop testing.

---

## 7. Technology

- **Client:** WebGL (Three.js), plain ES modules, bundled with esbuild into a
  single HTML file. Runs in any phone browser today; installs as a PWA; wraps
  with **Capacitor** for the App Store and Google Play without a rewrite.
- **Why web first:** instant to play from a link, which is exactly what a
  TikTok viewer needs (no store install between the clip and the game).
- **Save:** local for now. **Phase 2:** accounts and cloud saves on
  Supabase (Postgres + auth + edge functions).
- **Async raids:** raid results validated server-side from a deterministic
  replay to stop cheating.
- **Shared seas:** authoritative Node game servers (Colyseus-style rooms),
  region shards, interest management.
- If the game outgrows the browser (hundreds of players, heavier visuals) the
  design ports cleanly to Unity/Godot; all content here is data-driven.

---

## 8. Business model (designed in, switched off)

Nothing is sold in the current build. The design leaves room for it:

- **Free to play. Never pay-to-win in PvP.** Power comes from play.
- **Cosmetics store:** sails and emblems, hull paint, figureheads, flags,
  captain outfits, cannon smoke colours, hideout decorations. The ship is on
  screen constantly and in every clip, which makes it the best canvas.
  *(Hook already in code: ship sail colour is a cosmetic slot.)*
- **Seasons ("Letters of Marque"):** an 8–10 week battle pass with a free
  track and a paid track of cosmetics, themed around a new region or monster.
- **Captain's Club subscription:** monthly cosmetic, longer offline
  production cap, extra job-board refreshes, a second ship berth. Convenience
  and identity, not combat stats.
- **Light, optional rewarded ads:** e.g. instant repair or a job re-roll.
  Never interrupting play.
- **No loot boxes** (regulatory risk in several countries, and players hate
  them). Direct purchase only.
- **Soft currency** (gold) is earned only. A **premium currency** buys
  cosmetics and the pass.

### Going viral
- **Clip-shaped moments by design:** the boarding leap, a mast coming down,
  the Kraken's arms rising, a raid that empties a rival's vault.
- **One-tap share:** record the last 20 seconds and export vertical video with
  the game's link burned in.
- **Raid replays and revenge** generate rivalries and the "look what this guy
  did to my base" post.
- **Creator codes and named ships:** viewers can find and raid a creator's
  hideout; creators get a cosmetic kickback.
- **Play from the link:** the web build means the clip's link *is* the game.

---

## 9. Roadmap

| Phase | Goal | Contents |
|---|---|---|
| **0.1 — Vertical slice** *(this build)* | Prove the loop feels good on a phone | Sailing, broadsides, boarding, sword/gun combat, 9 islands, towns with services, trade, story chain + job board, treasure maps, monsters, Kraken and ghost ship, storms and sirens, hideout building, fort raid vs AI, ship/weapon upgrades, captain customization, three companions, local save |
| **0.2 — Feel and depth** | Make it something you replay | Combat polish and animation, wind and weather, day/night, more enemy and job variety, caves, sound and music pass, tutorial polish, performance on low-end phones |
| **0.3 — Online foundations** | Your pirate lives in the cloud | Accounts, cloud save, leaderboards, cosmetics inventory, analytics |
| **0.4 — Raids** | Steal from real players | Async hideout raids, replays, revenge, shields, leagues, free-placement defences |
| **0.5 — Shared seas** | Meet other players | Real-time sea instances, lawless waters PvP, crews, chat/emotes |
| **0.6 — Soft launch** | Test retention and spend | Store builds via Capacitor, cosmetics store, first season, share-clip tool, one test market |
| **1.0 — Launch** | Go wide | Creator programme, live-ops calendar, world events |

### What we measure before spending on marketing
Day-1 / day-7 retention, average session length, % of players who complete the
story chain, % who build a second hideout building, and share rate per player.

---

## 10. Multiplayer: what I will need from you

Nothing yet. The game should get deeper and prove it is fun solo first. When
we start Phase 0.3, these are the accounts only you can create (they need your
identity or a payment card). I can do all the building and configuration once
they exist.

| When | What | Why | Rough cost |
|---|---|---|---|
| 0.3 | **Supabase project** (database, logins, cloud saves) | Stores every player's pirate, hideout and inventory | Free to start; ~$25/mo once there are real players |
| 0.3 | **A domain name** and a static host (Cloudflare Pages or Netlify) | The public link people play from | ~$12/yr + free hosting |
| 0.3 | **Sign-in providers:** Apple and Google developer console access | "Sign in with Apple/Google" so players keep their progress | Covered by the store accounts below |
| 0.4 | Nothing new | Async raids run on Supabase (database + server functions) | Scales with players |
| 0.5 | **A game-server host** (Fly.io or Hetzner) | Real-time shared seas need always-on servers near players | ~$10-40/mo for a first region; grows with concurrent players |
| 0.6 | **Apple Developer** and **Google Play Console** accounts | Required to publish to the App Store and Play Store | $99/yr and $25 once |
| 0.6 | **A business entity, bank account and tax details** | Apple/Google will not pay out in-app purchases without them | Varies by country |
| 0.6 | **Privacy policy and terms**, age rating answers | Store requirement; also needed for accounts and purchases | Template + a lawyer's review recommended |
| 0.6 | **RevenueCat** (purchases) and an analytics tool (PostHog) | One place to manage purchases across both stores; retention numbers | Free tiers to start |

Decisions I will ask you for at that point: which regions to launch in first,
whether accounts are required or optional (guest play converts better), and
how PvP losses should feel (how much loot a raid can take).

---

## 11. Why players might not come back, and what the game does about it

| Risk | What it looks like | Built in now | Still to do |
|---|---|---|---|
| Content runs out | Story ends, nothing left to chase | Bounty board of named captains that return stronger each time; daily orders; 15 deeds; two more story chapters | New regions, seasonal story arcs, world events |
| No reason to open it today | Player drifts away after a week | Three daily orders, a day streak with a growing share, hideout production while away, a welcome-back screen that says where you left off | Push notifications (needs the store app), weekly orders |
| Lost in the first five minutes | Does not know what to do or how | One-time tips that fire at the right moment, a Help page, the compass marker, a visible menu | A hand-held first voyage; a short intro scene |
| Losing feels unfair | Sunk twice, quits | Losing only costs some gold and cargo; after repeat losses enemies quietly hit softer for a while | Difficulty choice; clearer threat rating on each enemy |
| Long, empty sailing | Crossing the map is dull | Trade winds: +75% speed at full sail on quiet water; sea events; course marker | Fast travel between visited ports; more things to find mid-crossing |
| Runs badly on a weak phone | Stutter, heat, battery | Auto resolution drop, a Low/Auto/High graphics setting, single file with no downloads | Level-of-detail for far islands, 30 fps battery mode |
| Progress wiped | Browser clears storage, weeks lost | Backup code: copy it out, paste it back, or move to another device | Cloud saves with accounts (phase 0.3) |
| Grind wall | Next upgrade feels too far | Deeds and dailies pay gold and materials; bounties pay big | Tune prices from real play data |
| Combat gets samey | Same three enemies | Shot types, surrender, flags and factions change how each fight goes | More enemy ship behaviours, sword skills, mini-bosses |
| No sound identity | Feels flat without music | Synthesised effects | Music and voice barks |
| Nothing to show off | No reason to tell a friend | Custom captain, sails and flag | Share-clip button, friends and raids (online phases) |

---

## 12. Fleet, deck life and the living world (build 0.4)

### The twelve hulls
Upgrades add a percentage to a hull's own numbers, so a small ship never catches a big one.

| Hull | Role | Rig | Guns a side | Hull | Speed | Hold | Price |
|---|---|---|---|---|---|---|---|
| Cutter | Starter | Gaff | 2 | 90 | 15 | 14 | free |
| Sloop | Fast | Square | 3 | 125 | 17 | 18 | 900 |
| Fluyt | Cargo | Square, fat hull | 3 | 180 | 12.5 | 56 | 1,700 |
| Brig | Strong | Square | 5 | 235 | 14 | 34 | 2,600 |
| Schooner | Fast | Gaff, raked masts | 4 | 175 | 19.5 | 26 | 3,400 |
| Xebec | Fast and strong | Lateen, beaked bow | 6 | 245 | 18 | 30 | 5,200 |
| Brigantine | All-rounder | Square, tall | 6 | 300 | 15.5 | 46 | 5,800 |
| Galleon | Cargo and strong | Square, high castles | 7 | 410 | 12 | 92 | 8,200 |
| Frigate | Strong | Square, gun band | 8 | 430 | 15 | 50 | 9,800 |
| Clipper | Fastest | Square, very tall | 6 | 310 | 21.5 | 46 | 12,500 |
| East Indiaman | Biggest hold | Square, high castles | 8 | 540 | 12.5 | 140 | 15,500 |
| Man-o'-War | Strongest | Square, two gun decks | 12 | 740 | 13 | 70 | 22,000 |

Later these become the premium line: rare hulls, figureheads and paint are the natural cosmetic sale.

### Deck life and the first mate
- **Walk the deck** while under sail. The ship holds her course, or the **first mate** sails to
  any place you mark on the chart, steering round land and furling sail on arrival.
- Standing on the hatch lets you **patch the hull** with timber.
- **Fast travel** to a known port for a pilot's fee.

### Why this matters for multiplayer
The deck is already a place with jobs. With several players on one ship each takes a station:
helm, port guns, starboard guns, swivel, repair, boarding party. The first mate fills any
empty station. Position on deck is stored in ship space (not world space), which is exactly
what a server needs to keep several players standing on one moving ship.

### Islands
Coasts now have headlands and coves, some islands have mountains and jungle, and six have a
**cave**: a dark room with a mini-boss and a hoard that refills over time. Each landing also
rolls **chance encounters** that stay off the compass until you are close: buried caches,
castaways, idols that bless or curse, and ambushes.

### On foot
WHIRL (a spin that cuts everything around you, on a cooldown), powder flasks (thrown, burst on
a group), three mini-bosses, and enemy ships that use chain and fire shot and board *you* when
your hull is low.

### Day, night, sound, speed
A full day runs about 13 minutes with dawn, dusk, stars and lit windows. Music is generated in
code (sailing, town, night and battle tunes) with creaks and gulls, and has its own off switch.
To pay for the richer look: far islands are hidden, mid-distance islands drop trees and
buildings, the draw distance is cut to match the fog, and the Low graphics setting halves
particles and sharpness.

## 13. Crew, command and single guns (build 0.5)

- **Hired hands.** Taverns have a Hands tab. Nine trades: Deckhand, Gunner, Rigger, Carpenter, Surgeon, Quartermaster, Swordmaster, Musketeer, Bruiser. Three grades (Green, Able, Veteran) scale both cost and effect. Berths = ship class + 2 + berth upgrades + Crew Quarters.
- **Ship bonuses** come from the crew list (cannon damage, reload, speed, hull mending, plunder), capped so no build is runaway.
- **Fighting hands.** Up to six board beside the captain. Up to three chosen hands go ashore on raids and into caves. A hand who falls is gone for good unless a surgeon saves them; morale drops.
- **Morale** (0 to 100) nudges speed and reload. Wins raise it; deaths, defeat and sinking lower it. Rum rations and sharing plunder restore it. Below 20, hands desert in port.
- **Command** (Menu, or the CREW button at sea): stations (even, sails, guns, damage parties) and orders (fire at will, double-shot, brace, lighten ship, rum ration, share plunder).
- **Single guns.** While walking the deck, stand at any cannon and man it: aim, set range, fire. Each gun has its own reload keyed by side and index, which is the hook for one player per gun in multiplayer.
- **Light.** Nights are brighter. The captain carries a torch in caves and after dark. Caves are lit warm.

## 14. Bosses, tavern games, skills, supplies (build 0.6)

- **Berths by hull.** Cutter 3, Sloop 4, Fluyt 5, Brig 6, Schooner 6, Xebec 8, Brigantine 8, Clipper 9, Galleon 10, Frigate 11, East Indiaman 12, Man-o'-War 16. Berth upgrades, Crew Quarters, Leadership and Born Leader add more.
- **Poseidon.** Rises in Poseidon's Throne (south-west). Lightning strikes telegraphed by a red ring; every fourth attack is a surge that shoves the ship back. First kill grants a permanent 8% speed. Returns after 20 minutes.
- **The Pale Lantern.** A ghost brig that only sails at night and fades at dawn. The Drowned Queen remains the ghost boss of the Reach.
- **Tavern games** (Games tab): Liar's Dice, Twenty-One, Crown and Anchor, arm wrestling. Stakes of 10, 50 or 250 gold. Gold only, never real money.
- **Skills and feats.** 2 points per rank. Seven skills, five steps each, each step a fixed bonus. Three steps in a skill opens its feat (3 points).
- **Supplies.** Food, water and limes are used while sailing, scaled by crew size. Empty stores cut morale; no limes for a few minutes brings scurvy. Morale at zero is a mutiny: half the hands leave with some gold. One tap at any tavern bar refills.
- **Costs.** Hull repair scales with ship price and fitted upgrades. Special shot is fitted once (dear), then bought by the keg (cheap); each gun fired uses one.

## 15. Towns, forts, command bar, skill tree (build 0.7)

- **Three different ports.** Saltmere: a village round a cobbled square, with every trade. Port Regal: paved grid, church, governor's house; tavern, market, shipwright, no blacksmith. Black Shoals: boardwalk shanty with a tavern in a wreck; tavern, blacksmith, market, no shipwright. Each shop has its own shape and a painted sign.
- **Navy forts.** Fort Regal (large) and Gull Battery (small): stone walls, towers, marines, riflemen and a commandant, all 45% stronger than usual. The strongroom pays very well, costs navy standing, and refills after 30 minutes.
- **Command bar.** EVEN / SAILS / GUNS / MEND buttons on the left of the sailing screen. A change takes 3 to 5 seconds while the hands move.
- **Skill tree.** Three constellations (Blade and Pistol, The Sea, Captaincy). Each starts at one star and forks. Deeper stars cost more points. 3 points per rank.
- **Characters.** Faces, rounded joints, breathing and weight-shift when idle, hip roll and counter-twist when running. Torch is carried in the off hand. Hold SHOOT to aim the pistol, release to fire.
- **Fixes.** Released ships cannot be robbed twice. Boulder collision matches the rock. Fewer ships at sea. Nothing is planted inside a boulder or wall.

## 16. Taverns you walk into, townsfolk, fort alarms (build 0.8)

- **Tavern interior.** The tavern door leads to a room: the keeper behind the bar (jobs, bounties, drink, stores), hands for hire standing along the wall, three gaming tables and the arm wrestler by the fire. Each is a tap-to-talk spot.
- **Townsfolk favours.** Widow Corrin (Saltmere), Dr. Ambrose Pell (Port Regal) and Rook (Black Shoals) each give a short chain that leans on the main story: Bloodwater, the walking dead and the Drowned Queen, Poseidon, and Fort Regal.
- **Fort alarm.** Wake one defender of a fort and the whole garrison comes.
- **Fort Regal** now stands on raised ground above its surroundings.
- **Pistols.** No auto-aim: the shot goes where the line points. Enemy marksmen and enemy gun crews are poor shots at low rank and sharpen as the captain rises.
- **Ship ride.** The hull sits on the highest wave under it and pitches with the swell, so water no longer washes over the deck; the wake is emitted astern of the hull.

## 17. The seas beyond the gates (build 0.9)

- **Gates.** The Ember Gate (The Hunter chart) lies south-west of Saltmere; the Frost Gate (The Wolf chart) south-east of Port Regal. Sail the chart's three stars in order to open a gate; sail through to cross. A gate on the far side leads home. Crossing leaves the old sea's ships behind.
- **Ember Sea.** Black sand, ash slopes and dead trees. Emberwake Isle has an active volcano: it smokes, and erupts every 80 to 140 seconds, raining lava bombs into the sea and bringing an ash storm. Ash Cultists hold the islands; Ember Raiders (fire shot) patrol in numbers; the Ash Wyrm rises near Serpent Rock.
- **Frost Sea.** Snow and glacier ground, white peaks, constant snowfall; storms bring heavy snow. Frost Raiders and a Frost Giant on every island; polar bears, wolves and white hares; the Yeti guards the heights of Stormhold. Ice Reavers patrol with chain shot.

- **Eruptions** are rare: the first about 90 seconds after arrival, then every 4 to 7 minutes.
- **Fortified ports.** Ashhold (Ember Sea) and Icewatch (Frost Sea) are walled safe harbours with a tavern, shipwright, blacksmith and market. No bandit camp, and no raiders spawn within about 420 units.

- **Region gear.** Ashhold (Ember) sells the Emberglass Cutlass (42 damage), the Cinder Musket (120 damage) and the Fireproof Hull refit (fire does no harm to your ship). Icewatch (Frost) sells the Frostglass Sabre (46 damage), the Harpoon Gun (112 damage) and the Icebreaker Bow refit (+20% hull, +10% speed). Each shows only at its own port, and stays owned after you leave.
