#!/usr/bin/env bash
# QuizMaster Launcher (Solus Linux GNOME)
# Prefers native GTK4/Libadwaita desktop window, with fallback to browser

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$DIR"

# Check if a graphical session is active (X11 or Wayland)
HAS_DISPLAY=0
if [ -n "$DISPLAY" ] || [ -n "$WAYLAND_DISPLAY" ]; then
    HAS_DISPLAY=1
fi

# Try native GNOME GTK4 / Libadwaita desktop window if display is active
if [ "$HAS_DISPLAY" -eq 1 ]; then
    if python3 -c "import gi; gi.require_version('Gtk', '4.0'); gi.require_version('Adw', '1'); gi.require_version('WebKit', '6.0'); from gi.repository import Gtk, Adw, WebKit" >/dev/null 2>&1; then
        echo "⚡ Launching QuizMaster native GNOME application (GTK4 + Libadwaita)..."
        exec python3 "$DIR/native_app.py" "$@"
    fi
fi

# Fallback: Web browser mode
PORT=8000
while lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; do
    PORT=$((PORT + 1))
done

echo "=================================================="
echo "⚡ Starting QuizMaster (Offline Web Mode)"
echo "📍 URL: http://localhost:$PORT"
echo "=================================================="

(
    sleep 0.8
    if command -v xdg-open >/dev/null 2>&1; then
        xdg-open "http://localhost:$PORT" >/dev/null 2>&1
    fi
) &

exec python3 "$DIR/server.py" "$PORT"
