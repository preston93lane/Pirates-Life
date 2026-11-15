# Pirate's Life

An open-sea pirate adventure for phones, built with WebGL (Three.js). Sail an
archipelago, fight broadside battles, board ships, explore islands on foot,
dig up treasure, fight monsters, and build a hideout.

- **Design plan and roadmap:** [GAME_DESIGN.md](GAME_DESIGN.md)
- **Status:** 0.1 vertical slice, single player, saves locally in the browser.

## Play / develop

```bash
npm install
```

```bash
npm run dev
```

Then open http://localhost:5173 (use your phone on the same network, or a
desktop browser with keyboard controls).

```bash
npm run build
```

Writes `dist/index.html`: the whole game in one self-contained file that can
be hosted anywhere or wrapped with Capacitor for the app stores.

## Controls

| | Touch | Keyboard |
|---|---|---|
| Steer / move | Left thumb joystick | WASD or arrows |
| Look | Drag the screen | Drag with the mouse |
| Sails | SAIL / REEF, or flick the stick up or down | X / Z |
| Fire broadside / strike | FIRE / STRIKE | Space |
| Block (parry if timed) | BLOCK | Q |
| Dodge | DODGE | Shift |
| Shoot | SHOOT | F |
| Drink rum | Bottle | R |
| Board, go ashore, talk, dig | The gold button | E |
| Captain's log | Book button | M |

## Layout

```
src/main.js       loop, camera, switching between sea / shore / boarding
src/data.js       all content: islands, ships, weapons, foes, story, pets
src/state.js      save data, stats, economy
src/world.js      ocean, sky, weather, island terrain, towns, hideout
src/ship.js       ship models and sailing physics
src/sea.js        AI ships, gunnery, salvage, Kraken, storms, sirens
src/land.js       on-foot combat, boarding fights, chests, digging, pets
src/character.js  people, crabs and companion animals
src/quests.js     story chain and tavern jobs
src/ui.js         HUD and menus
src/fx.js         particles          src/audio.js  synthesised sound
tools/build.mjs   bundles everything into one HTML file
```
