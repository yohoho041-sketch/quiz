#!/usr/bin/env bash
# One-Command Installer and Setup for QuizMaster on Solus Linux
# Requires 0 external downloads, 0 pip packages, 0 npm packages. 100% offline.

set -e

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$APP_DIR"

echo "=========================================================="
echo "⚡ Installing QuizMaster MCQ Application (Solus Linux)"
echo "=========================================================="

# 1. Verify Python 3
if ! command -v python3 >/dev/null 2>&1; then
    echo "❌ Error: Python 3 is not found. Please install python3."
    exit 1
fi
echo "✓ Python 3 verified: $(python3 --version)"

# 2. Make scripts executable
chmod +x run.sh install.sh
ln -sf run.sh quiz-app
echo "✓ Executable permissions configured."

# 3. Create app icon
mkdir -p "$APP_DIR/static"
cat << 'EOF' > "$APP_DIR/static/icon.svg"
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="100%" height="100%">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#1e293b"/>
    </linearGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#6366f1"/>
      <stop offset="100%" stop-color="#06b6d4"/>
    </linearGradient>
  </defs>
  <rect width="128" height="128" rx="28" fill="url(#bg)" stroke="#334155" stroke-width="4"/>
  <rect x="24" y="24" width="80" height="80" rx="18" fill="url(#accent)"/>
  <path d="M 68 36 L 46 72 L 62 72 L 56 94 L 84 56 L 68 56 Z" fill="#ffffff"/>
</svg>
EOF
echo "✓ App icon generated."

# 4. Initialize Database and Seed Sample Quizzes
python3 seed_data.py
echo "✓ Offline SQLite database and sample diagram quizzes initialized."

# 5. Create Desktop Launcher for Solus Linux (Budgie / GNOME / MATE) if ~/.local is writable
DESKTOP_DIR="$HOME/.local/share/applications"
if mkdir -p "$DESKTOP_DIR" 2>/dev/null && [ -w "$DESKTOP_DIR" ]; then
    cat << EOF > "$DESKTOP_DIR/quizmaster.desktop"
[Desktop Entry]
Name=QuizMaster
Comment=Clean Dark Mode MCQ Quiz App with Diagrams
Exec=$APP_DIR/run.sh
Icon=$APP_DIR/static/icon.svg
Terminal=false
Type=Application
Categories=Education;Utility;
Keywords=quiz;mcq;study;exam;
EOF
    chmod +x "$DESKTOP_DIR/quizmaster.desktop" 2>/dev/null || true
    echo "✓ Desktop application entry created in $DESKTOP_DIR/quizmaster.desktop"
else
    echo "ℹ Note: Skipping desktop menu shortcut (~/.local is read-only or unavailable)."
fi

# 6. Create CLI shortcut in ~/.local/bin if writable
BIN_DIR="$HOME/.local/bin"
if mkdir -p "$BIN_DIR" 2>/dev/null && [ -w "$BIN_DIR" ]; then
    cat << EOF > "$BIN_DIR/quiz-app"
#!/usr/bin/env bash
exec "$APP_DIR/run.sh" "\$@"
EOF
    chmod +x "$BIN_DIR/quiz-app" 2>/dev/null || true
    echo "✓ Global CLI shortcut 'quiz-app' created in ~/.local/bin/quiz-app"
else
    echo "ℹ Note: Use './quiz-app' or './run.sh' to launch."
fi

# 7. Run self-test
echo "⏳ Running automated self-tests..."
python3 tests/test_server.py >/dev/null 2>&1
echo "✓ All self-tests passed successfully!"

echo ""
echo "=========================================================="
echo "🎉 Installation Complete!"
echo "To launch QuizMaster:"
echo "  ./run.sh"
echo "  or"
echo "  ./quiz-app"
echo "=========================================================="
echo ""
echo "Launching QuizMaster now..."
exec "$APP_DIR/run.sh"
