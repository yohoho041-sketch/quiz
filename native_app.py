"""
Native GNOME Desktop Application for QuizMaster.
Built with GTK 4, Libadwaita (Adw 1), and WebKit 6.
Pure edge-to-edge frameless layout without redundant headers.
Runs 100% offline on Solus Linux.
"""

import sys
import os
import socket
import threading

# Ensure workspace is in sys.path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE_DIR)

import database
from server import QuizRequestHandler, ThreadingHTTPServer

# PyGObject requirements
import gi
gi.require_version('Gtk', '4.0')
gi.require_version('Adw', '1')
gi.require_version('WebKit', '6.0')
from gi.repository import Gtk, Adw, WebKit, Gio


def find_free_port(start_port=8000):
    port = start_port
    while port < 9000:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            if s.connect_ex(('127.0.0.1', port)) != 0:
                return port
        port += 1
    return start_port


class QuizMasterApp(Adw.Application):
    def __init__(self):
        super().__init__(
            application_id="org.solus.QuizMaster",
            flags=Gio.ApplicationFlags.FLAGS_NONE
        )
        self.server = None
        self.server_thread = None
        self.port = find_free_port(8000)
        self.window = None
        self.webview = None

    def start_background_server(self):
        database.init_db()
        self.server = ThreadingHTTPServer(("127.0.0.1", self.port), QuizRequestHandler)
        self.server_thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.server_thread.start()
        print(f"[QuizMaster] Local offline server started on port {self.port}")

    def do_activate(self):
        if not self.server:
            self.start_background_server()

        # Enforce GNOME dark theme
        style_manager = Adw.StyleManager.get_default()
        style_manager.set_color_scheme(Adw.ColorScheme.FORCE_DARK)

        # Create native window
        self.window = Adw.ApplicationWindow(application=self)
        self.window.set_title("QuizMaster")
        self.window.set_default_size(1280, 840)

        # Embedded WebKit WebView without extra redundant headerbar
        self.webview = WebKit.WebView()
        self.webview.set_vexpand(True)
        self.webview.set_hexpand(True)

        # Direct native message handler for instant exit
        ucm = self.webview.get_user_content_manager()
        ucm.register_script_message_handler("closeApp")
        ucm.connect("script-message-received::closeApp", lambda *args: self.window.close())

        settings = self.webview.get_settings()
        settings.set_enable_developer_extras(False)
        settings.set_javascript_can_open_windows_automatically(True)
        settings.set_enable_fullscreen(True)
        settings.set_enable_smooth_scrolling(True)
        settings.set_enable_page_cache(False)

        # Suppress WebKit context menu
        self.webview.connect("context-menu", lambda *args: True)

        # Handle window.close() from web frontend to cleanly terminate native window
        self.webview.connect("close", lambda *args: (self.window.close(), True))

        # Maximize native window for generous viewing area
        self.window.maximize()

        # Direct edge-to-edge content
        self.window.set_content(self.webview)

        # Load local server URL
        url = f"http://127.0.0.1:{self.port}"
        self.webview.load_uri(url)

        # Handle window close
        self.window.connect("close-request", self.on_close_request)
        self.window.present()

    def on_close_request(self, window):
        print("[QuizMaster] Closing native window and shutting down server...")
        if self.server:
            self.server.shutdown()
            self.server.server_close()
        return False


def main():
    app = QuizMasterApp()
    return app.run(sys.argv)


if __name__ == "__main__":
    sys.exit(main())
