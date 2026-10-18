# Line 6 replica: top-panel controls

Source of truth for `src/components/stomp/`. Taken from the current English owner's manuals on line6.com: the 3.80 manuals for HX Stomp, HX Stomp XL, Helix Floor, Helix LT and HX Effects, and the 2.50 manual for POD Go, which never got 3.x firmware. Row and column positions come from the manual diagrams. "Top row" means the row farther from the player. Anything marked **unverified** could not be confirmed from manual text.

The per-unit switch map lives in `src/components/stomp/hardware.ts`. If this table changes, change that file.

## Deliberate differences from the hardware

| Hardware | Replica | Why |
|---|---|---|
| Pressing a parameter knob resets it to its default | Tap does nothing; drag or use the arrow keys to turn | Product rule: a tap must never wipe a tuned knob (CLAUDE.md, `userEdited`) |
| HX Stomp has 4 footswitch modes (Stomp, Scroll, Preset, Snapshot) | Stomp, Preset, Snapshot | The app exports Stomp or Snapshot; Scroll only steps presets |
| Enter Snapshot mode with BANK ▲+▼ (XL, Helix, HX Effects, POD Go) | Same two-switch press works, and the Snapshot/Stomp/Preset chips above the replica also switch modes | Pressing two switches at once is hard on a phone |
| Lower knob / joystick turn changes the model | Shows the model; models change in HX Edit / POD Go Edit | The replica edits knobs, bypass and snapshots, not the model list |
| Hold MODE for Pedal Edit, Looper modes, Scroll mode | Not modelled | Not part of what a downloaded preset sets up |
| Tuner reads the guitar | Tuner screen shows "Play a string" | The page hears nothing |
| Signal-flow blocks on the screen are selected with the knob or joystick | You can also tap a block on the screen | Mobile |

## HX Stomp

3 snapshots per preset. 126 presets (42 banks × A–C). 2.4" color LCD. No built-in expression pedal.

| Position | Control | Press / turn / hold | What it does |
|---|---|---|---|
| Top-left | Main display | — | **Play view:** preset number and name on top, the current mode's footswitch labels below. **Edit view:** signal flow on top, the selected block's parameters below. |
| Right of LCD, top-left | VIEW (Home icon) | Press | Home. Press again to toggle Play and Edit view |
| Right of LCD, top-right | ACTION | Press | Action panel (move, copy, paste, clear, Favorites) |
| Between them | SAVE (silkscreen only) | VIEW + ACTION | Save. Pressing the pair twice quick-saves |
| Right of LCD, between VIEW and ACTION | Upper knob | Turn / press | **Play view:** turn to pick a preset; press for the Preset List. **Edit view:** turn to select a block; press to bypass it |
| Below the upper knob | Lower knob | Turn / press | **Edit view:** turn to change the model; press for the model list |
| Upper + lower knob | — | Press both | All bypass |
| Right of LCD, lower row | ‹PAGE / PAGE› | Press | **Play view:** cycle the footswitch modes. **Edit view:** more parameter pages. Both together open the Menu |
| Below LCD | Knobs 1–3 | Turn / press / hold | **Turn:** adjust the parameter. **Press:** reset to default. **Hold:** Controller Assign. **Press and turn:** assign to snapshots |
| Far top-right | VOLUME | Turn | Main and headphone level |
| Bottom row | FS1 FS2 FS3 | Press / touch / hold | Capacitive switches with LED rings and no scribble strips; their labels show on the LCD. FS3 is silkscreened TAP/TUNER |

| Mode | FS1 | FS2 | FS3 |
|---|---|---|---|
| Stomp | Stomp 1 | Stomp 2 | TAP: press for tempo, hold for the tuner. Global Settings can make FS3 Stomp 3 |
| Preset | Preset A | Preset B | Preset C. FS1+FS2 goes a bank down; FS2+FS3 a bank up |
| Snapshot | Snapshot 1 | Snapshot 2 | Snapshot 3 |

- **Tuner:** hold FS3 in Stomp mode. Press any switch to leave.
- **LED rings:**
  - A bypassed block's ring dims.
  - TAP flashes red at the tempo.
  - The snapshot LED color is the snapshot's color.

## HX Stomp XL

4 snapshots per preset. 128 presets (32 × A–D). 2.4" color LCD. No built-in pedal. VOLUME is on the rear panel; it pushes in to recess. 8 capacitive switches with LED rings and no scribble strips; the LCD Play view shows their labels.

Layout, 4 + 4:

- Top row: FS1 (BANK ▲), FS2 (C), FS3 (D), MODE (EDIT/EXIT).
- Bottom row: FS4 (BANK ▼), FS5 (A), FS6 (B), TAP (TUNER).

That MODE sits on the top row and TAP on the bottom is **unverified** from a photo. It matches the HX Effects and POD Go diagrams.

The controls are the same as HX Stomp: VIEW, ACTION, SAVE, upper and lower knobs, ‹PAGE / PAGE› and Knobs 1–3. On the XL, MODE changes the footswitch mode.

| Mode | How to enter | FS1 / FS2 / FS3 | FS4 / FS5 / FS6 |
|---|---|---|---|
| Stomp (6 Switch) | MODE | Stomp 1–3 | Stomp 4–6 |
| Preset | MODE | BANK ▲ / C / D | BANK ▼ / A / B. The active preset has a red ring |
| Snapshot | Press FS1 + FS4 together | ▲ / Snap 3 / Snap 4 | ▼ / Snap 1 / Snap 2. MODE exits |

- **MODE:**
  - Press toggles Stomp and Preset.
  - Hold 1 s for Pedal Edit.
  - Press exits Snapshot mode.
- **TAP:**
  - Press for tempo.
  - Hold 1 s for the tuner.
  - Touch opens the tempo panel.

## Helix Floor

8 snapshots. 1,024 presets. 6.2" 800×480 LCD. 12 capacitive switches in 2 rows of 6, each with an LED ring and a scribble strip. There is also a 13th strip above the pedal.

| Position | Control | Action |
|---|---|---|
| Left of LCD | SAVE, Menu, **PRESET knob** (turn = preset, press = setlist), Home, Amp | As named. Amp jumps to the amp's tone stack |
| Right of LCD | BYPASS (press = selected block on/off; hold = Global EQ), ACTION, joystick (move = select block, turn = model, press = model list), ‹PAGE / PAGE› | |
| Below LCD | Knobs 1–6 | Turn = adjust; press = reset; hold = Controller Assign |
| Top-right | VOLUME, PHONES | |
| Right side | Expression pedal with toe switch | Toe toggles EXP 1 (wah, pitch) and EXP 2 (volume, pan). The strip above the pedal shows which one and its position |
| Silkscreen | FS1 BANK ▲, FS7 BANK ▼, FS6 MODE (hold to edit), FS12 TAP (hold for tuner) | |

| Mode | Top row FS1–FS6 | Bottom row FS7–FS12 |
|---|---|---|
| Stomp | ▲ / Stomps on FS2–5 / MODE | ▼ / Stomps on FS8–11 / TAP |
| Preset (8 Presets) | ▲ / next bank A–D / MODE | ▼ / this bank A–D / TAP. The active preset is red |
| Snapshot (BANK ▲+▼) | ▲ / Snaps 5–8 / CANCEL | ▼ / Snaps 1–4 / TAP |

- Hold TAP for the tuner.
- Touching a switch selects its block.
- The scribble strips show the assignment names.

## Helix LT

Same as Helix Floor, with these differences:

- **No scribble strips.** The main LCD's **Performance view** shows the 8 middle switches as large boxes. Home toggles between Signal Flow and Performance view.
- There is one VOLUME knob and no PHONES knob.
- EXP 1 / EXP 2 LEDs: red = EXP 1, green = EXP 2.
- Silkscreen: FS6 MODE, FS12 TAP/TUNER, and A B C D under FS8–11.

The modes are the same as on the Floor.

## HX Effects

4 snapshots. 128 presets.

- **No main LCD.** Six scribble strips above FS1–6 are the display. The selected strip is bracketed in white, and Knobs 1–3 edit it.
- 8 capacitive switches: top row FS1 FS2 FS3 MODE, bottom row FS4 FS5 FS6 TAP.
- No volume knob. No built-in pedal.

| Position | Control | Action |
|---|---|---|
| Top-left | SAVE, Menu, Home | Menu > Signal Flow shows the blocks across the scribble strips |
| Center-left | BIG KNOB | Turn = model (Stomp) or preset (Preset); press = model list |
| Center | Knobs 1–3 | Edit the selected strip's block |
| Right | ACTION, ◀ / ▶ | Action panel; parameter pages |
| MODE + TAP | — | All bypass |

The modes match the XL table: Stomp 1–6; Preset ▲ C D / ▼ A B; Snapshot ▲ S3 S4 / ▼ S1 S2. MODE exits Snapshot. Hold TAP 1 s for the tuner.

## POD Go

4 snapshots. 4.3" color LCD. The footswitches are **not** touch-sensitive.

- Top row: FS1 (▲), FS2 (C), FS3 (D), MODE (EDIT/EXIT).
- Bottom row: FS4 (▼), FS5 (A), FS6 (B), TAP (TUNER).
- There are no scribble strips; the LCD Play view shows footswitch boxes.

| Position | Control | Action |
|---|---|---|
| Top-left | Main display | **Play view:** preset on top, footswitch boxes below. **Edit view:** fixed-order block chain plus parameters |
| Right of LCD | VIEW (Home icon), ACTION, upper knob, lower knob, ‹PAGE / PAGE›, VOLUME | As on HX Stomp |
| Below LCD | **Knobs 1–5** | Turn / press = reset / hold = assign |
| Right side | Expression pedal with toe switch; WAH/EXP 1 (red) and VOL/EXP 2 (green) LEDs | Toe toggles EXP 1 and EXP 2 |

Modes:

- **Stomp:** FS1–6.
- **Preset:** ▲ C D / ▼ A B.
- **Snapshot:** press ▲+▼; the layout is ▲ S3 S4 / ▼ S1 S2. MODE exits.

Hold TAP 1 s for the tuner.

## Export issues found while building the replica (not changed here)

- **Bypass index stored as is.** The exporter writes each bypass assignment's stored index straight to `@fs_index`. On Helix the data can land on hardware-reserved switches (FS1, FS6, FS7, FS12). On HX Effects and POD Go it can land on 7 or 8, which are MODE and TAP on those units. On HX Stomp, FS3 is TAP unless Global Settings changes it. The replica draws stomps only where the unit shows them.
- **Snapshot assignments.** Snapshot assignments in `preset.footswitches` use data indices. The hardware ignores them: in Snapshot mode it always puts snapshots where the tables above show. The replica follows the hardware.

## Sources

- HX Stomp 3.80 Owner's Manual (Hardware p.6–8; Play view and modes p.12; Tap/Tuner p.19; Snapshots p.43–44)
- HX Stomp XL 3.80 Owner's Manual (Hardware p.6–8; Play view p.12; Preset p.13; Snapshot p.14–15; Tuner p.23)
- Helix 3.80 Owner's Manual (Top Panel p.7–8; Preset, Stomp and Snapshot modes p.12–13; Tuner p.48; Snapshots p.49)
- Helix LT 3.80 Owner's Manual (Top Panel p.7–8; views p.10–11; modes p.13–15)
- HX Effects 3.80 Owner's Manual (Top Panel p.6–7; Stomp and All Bypass p.11; Snapshots p.31–32)
- POD Go 2.50 Owner's Manual (Top Panel p.6–7; modes p.12; Snapshots p.35)
- https://line6.com/support/manuals/ and https://kb.line6.com/helix-lt-comparison
