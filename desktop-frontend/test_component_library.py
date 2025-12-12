import sys
from PyQt5.QtWidgets import QApplication, QMainWindow
from src.component_library import ComponentLibrary


def main():
    app = QApplication(sys.argv)
    
    window = QMainWindow()
    window.setWindowTitle("Component Library Test")
    window.setGeometry(100, 100, 400, 600)
    
    component_library = ComponentLibrary(window)
    from PyQt5.QtCore import Qt
    window.addDockWidget(Qt.LeftDockWidgetArea, component_library)
    
    window.show()
    sys.exit(app.exec_())


if __name__ == "__main__":
    main()
