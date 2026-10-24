# QuizMaster ⚡

A high-performance, distraction-free **Multiple Choice Question (MCQ) Assessment & Quiz Application** with high-resolution diagram support, designed to run as a **native desktop application on Solus Linux GNOME** and **100% offline** with **zero external dependencies**.

---

## 🎨 Design Philosophy

Engineered with a **Linear/Raycast-inspired dark theme**:
- **Hardware-Tactile Keycaps**: Options are paired with physical-style keycap badges (`[A]`, `[B]`, `[C]`, `[D]`) for rapid keyboard answering.
- **Deep Slate Palette**: Minimalist surfaces (`#090c10`, `#0e1217`, `#151a22`), hairline borders (`1px solid rgba(255, 255, 255, 0.06)`), zero visual clutter.
- **Precision Metrics**: Monospace digital timer, clean percentage progress, and executive scorecards.
- **High-Fidelity Diagrams**: Question images and vector schematics open in a distraction-free Lightbox modal for full-resolution review.

---

## 🖥️ Native GNOME Solus App

Built with Solus Linux's native **GTK 4**, **Libadwaita (Adw 1)**, and **WebKit 6** stack:
- Runs in a native GNOME window with native Libadwaita dark headerbar and window controls.
- Seamlessly starts and stops the local offline Python server automatically.
- Accessible directly from the Solus Budgie / GNOME Application Menu.

---

## ⚡ Quick Start (One Command)

From this directory, run:

```bash
bash install.sh
```

Or launch it directly anytime:

```bash
./run.sh
```

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `A` `B` `C` `D` or `1` `2` `3` `4` | Select Answer Option |
| `←` or `P` | Previous Question |
| `→` or `N` | Next Question |
| `F` | Flag / Unflag Question for Review |
| `Esc` | Close Diagram Zoom Modal |

---

## 🧪 Automated Tests

Run backend tests:

```bash
python3 tests/test_server.py
```
