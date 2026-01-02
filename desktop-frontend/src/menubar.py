from PyQt5.QtWidgets import QMainWindow, QAction, QMenu, QMenuBar
from PyQt5.QtCore import Qt, pyqtSignal, QObject

class MenuBarManager(QObject):
    """
    Manages the Menu Bar for the CanvasScreen.
    Decouples menu creation and logic from the main screen class.
    """
    # Define generic signals that the main window can connect to
    new_project_clicked = pyqtSignal()
    open_project_clicked = pyqtSignal()
    save_project_clicked = pyqtSignal()
    save_project_as_clicked = pyqtSignal()
    back_home_clicked = pyqtSignal()
    
    undo_clicked = pyqtSignal()
    redo_clicked = pyqtSignal()
    delete_clicked = pyqtSignal()
    add_symbols_clicked = pyqtSignal()
    
    generate_excel_clicked = pyqtSignal()
    generate_report_clicked = pyqtSignal()
    
    logout_clicked = pyqtSignal()

    def __init__(self, main_window: QMainWindow):
        super().__init__(main_window)
        self.main_window = main_window
        self.init_menubar()

    def init_menubar(self):
        menubar = self.main_window.menuBar()
        menubar.clear()

        # --- File Menu ---
        file_menu = menubar.addMenu("File")
        
        new_action = QAction("New", self.main_window)
        new_action.setShortcut("Ctrl+N")
        new_action.triggered.connect(self.new_project_clicked.emit)
        file_menu.addAction(new_action)

        open_action = QAction("Open", self.main_window)
        open_action.setShortcut("Ctrl+O")
        open_action.triggered.connect(self.open_project_clicked.emit)
        file_menu.addAction(open_action)

        save_action = QAction("Save", self.main_window)
        save_action.setShortcut("Ctrl+S")
        save_action.triggered.connect(self.save_project_clicked.emit)
        file_menu.addAction(save_action)

        save_as_action = QAction("Save As...", self.main_window)
        save_as_action.setShortcut("Ctrl+Shift+S")
        save_as_action.triggered.connect(self.save_project_as_clicked.emit)
        file_menu.addAction(save_as_action)

        file_menu.addSeparator()

        back_action = QAction("Back to Home", self.main_window)
        back_action.triggered.connect(self.back_home_clicked.emit)
        file_menu.addAction(back_action)

        # --- Edit Menu ---
        edit_menu = menubar.addMenu("Edit")

        undo_action = QAction("Undo", self.main_window)
        undo_action.setShortcut("Ctrl+Z")
        undo_action.triggered.connect(self.undo_clicked.emit)
        edit_menu.addAction(undo_action)

        redo_action = QAction("Redo", self.main_window)
        redo_action.setShortcut("Ctrl+Y")
        redo_action.triggered.connect(self.redo_clicked.emit)
        edit_menu.addAction(redo_action)
        
        delete_action = QAction("Delete", self.main_window)
        delete_action.setShortcut("Del")
        delete_action.triggered.connect(self.delete_clicked.emit)
        edit_menu.addAction(delete_action)

        edit_menu.addSeparator()

        add_symbols_action = QAction("Add new symbols", self.main_window)
        add_symbols_action.triggered.connect(self.add_symbols_clicked.emit)
        edit_menu.addAction(add_symbols_action)

        # --- Generate Menu ---
        generate_menu = menubar.addMenu("Generate")

        excel_action = QAction("Excel", self.main_window)
        excel_action.setShortcut("Ctrl+E")
        excel_action.triggered.connect(self.generate_excel_clicked.emit)
        generate_menu.addAction(excel_action)

        report_action = QAction("Report", self.main_window)
        report_action.setShortcut("Ctrl+R")
        report_action.triggered.connect(self.generate_report_clicked.emit)
        generate_menu.addAction(report_action)

        
        profile_menu = menubar.addMenu("Profile")
        
        logout_action = QAction("Logout", self.main_window)
        logout_action.triggered.connect(self.logout_clicked.emit)
        profile_menu.addAction(logout_action)

