# Dice Duel

A 3D tavern dice game in the style of the Kingdom Come: Deliverance II dice minigame (Farkle rules).

**Play:** https://akingry.github.io/dice-duel/

- **Play the computer**, or
- **Play a friend online:** you both open the link, type the same room number (agree on it any way you like) and tap **Join**. Works phone-to-phone anywhere; both players need internet.

It's a single self-contained page (`index.html`): Three.js for the 3D table and PeerJS for peer-to-peer play. PeerJS's free public service only introduces the two players; the game itself travels directly between the two devices.

## Tokens

Every match starts with a **token draw**: each player takes one normal turn, and what they bank sets the metal of their token (a bust means no token). Then each player picks one of six Greek-myth statuettes. The lower draw throws first.

| Metal | Draw score |
|---|---|
| Wood | 50+ |
| Iron | 150+ |
| Copper | 250+ |
| Bronze | 400+ |
| Tin | 550+ |
| Silver | 750+ |
| Gold | 1,000+ |

| Token | Effect (wood → gold) |
|---|---|
| Sandal of Hermes — *Head Start* | Start with 50 → 500 points |
| Laurel of Nike — *Rally* | Once: arm it; your next banked turn gets +10% → +50% |
| Phoenix — *Second Wind* | Once: on a bust, keep 15% → 75% of that turn's points |
| Horn of Tyche — *Fortune* | Re-roll one die after a throw, even a bust; 1 → 5 uses |
| Charon's Ferry — *Toll* | Once: right after your opponent banks, cut that turn by 10% → 50% |
| Aegis of Athena — *Ward* | Blocks the opponent's token if yours is the same metal or better; otherwise drops theirs two metals |

## Rules

First to **5,000** wins. Every kept die must score. A roll with nothing to keep is a bust and the turn's unbanked points are lost. Score all six dice ("hot dice") and you get all six back.

| Combination | Points |
|---|---|
| Single 1 / single 5 | 100 / 50 |
| Three 1s | 1,000 |
| Three 2s–6s | face × 100 |
| Four / five / six of a kind | 2× / 4× / 8× the triple |
| 1-2-3-4-5 or 2-3-4-5-6 | 750 |
| 1-2-3-4-5-6 | 1,500 |

Desktop keys: **Space** roll · **C** keep & roll on · **P** keep & bank · **M** sound.

## Editing

Sources are in `src/`. Rebuild the page with:

```
python build_standalone.py --out index.html
```

This inlines `three.module.js` (r164) and `peerjs.min.js` (1.5.5) into one file.
