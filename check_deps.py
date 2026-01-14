try:
    from PyQt5.QtWebEngineWidgets import QWebEnginePage
    print("WebEngine Available")
except ImportError as e:
    print(f"WebEngine MISSING: {e}")

try:
    import jinja2
    print("Jinja2 Available")
except ImportError:
    print("Jinja2 MISSING")
