# QuizMaster ⚡

A high-performance, distraction-free **Online Assessment Platform & CBT Exam Portal** with strict **Anti-Cheating Proctoring**, offline KaTeX mathematical typesetting, and role-based security separating the public **Student Portal** from the **Teacher Studio**.

---

## 🎓 Public Student Portal vs 🔒 Teacher Mode

- **Student Portal (Default / Public View)**:
  - Students can only view available assignments and take examinations.
  - No creation, editing, or deletion controls are available to students.
  - Before starting an exam, students verify their identity with their **Full Name** and **Roll Number / Student ID**.
- **Real-Time Anti-Cheating & Exam Lockdown**:
  - Automatically activates **Fullscreen Mode** on exam start.
  - Detects tab switches, minimizing the browser, losing window focus, or switching applications.
  - Triggers an **immediate audio alert and high-visibility warning popup** notifying the student that their violation has been recorded.
  - Tracks total security warnings and stores them alongside their submitted attempt.
- **Teacher Mode (Protected with Master PIN)**:
  - Default Teacher PIN: `2026` (Customizable via `TEACHER_PIN` environment variable).
  - Can be unlocked via the top navigation bar or keyboard shortcut: `Ctrl + Shift + T` or `Alt + T`.
  - Gives full authority to create, edit, and delete assessments.
  - Unlocks the **Student Submissions & Marks Log** to review every student attempt, scores, JEE net marks, question-by-question breakdown, and proctoring warnings.

---

## 🚀 Connecting with Vercel

QuizMaster is pre-configured for 1-click deployment on [Vercel](https://vercel.com):

1. Push this repository to your GitHub account (`git push origin main`).
2. Go to [vercel.com](https://vercel.com) and click **"Add New Project"**.
3. Import your GitHub repository (`quiz`).
4. (Optional) In **Environment Variables**, set:
   - `TEACHER_PIN`: Your secret teacher passcode (e.g. `2026`).
5. Click **Deploy**. Vercel will build and serve both the frontend and the Python serverless backend automatically via `vercel.json` and `api/index.py`!

---

## 🖥️ Local & Native Desktop Execution

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
| `Ctrl + Shift + T` or `Alt + T` | Toggle Teacher Mode (PIN Authentication) |
| `Esc` | Close Modal / Lightbox |

---

## 🧪 Automated Tests

Run backend tests:

```bash
python3 tests/test_server.py
```

