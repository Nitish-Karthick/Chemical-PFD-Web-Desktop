import os
from PyQt5 import QtWidgets
from PyQt5.QtGui import QColor, QBrush, QKeySequence
from PyQt5.QtWidgets import QMainWindow, QWidget, QHBoxLayout, QShortcut, QMdiSubWindow, QSplitter
from PyQt5.QtCore import Qt

from src.canvas.widget import CanvasWidget
from src.component_library import ComponentLibrary
from src.theme import apply_theme_to_screen
from src.navigation import slide_to_index
import src.app_state as app_state
from src.theme_manager import theme_manager

class OverlayContainer(QWidget):
    def __init__(self, canvas, scroll_area, parent=None):
        super().__init__(parent)
        self.canvas = canvas
        self.scroll_area = scroll_area
        
        # Main Layout (Stacking)
        layout = QtWidgets.QGridLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        
        # Layer 0: Content
        layout.addWidget(self.scroll_area, 0, 0)
        
        # Layer 1: Toolbar (Bottom Right)
        # We put toolbar directly in grid
        self.toolbar_frame = QtWidgets.QFrame()
        self.toolbar_frame.setStyleSheet("background-color: white; border: 1px solid #e2e8f0; border-radius: 8px;")
        btn_layout = QtWidgets.QHBoxLayout(self.toolbar_frame)
        btn_layout.setContentsMargins(5, 5, 5, 5)
        
        self.zoom_out_btn = QtWidgets.QPushButton("-")
        self.zoom_out_btn.setFixedSize(30, 30)
        self.zoom_out_btn.clicked.connect(self.canvas.zoom_out)
        
        self.zoom_fit_btn = QtWidgets.QPushButton("Fit")
        self.zoom_fit_btn.setFixedSize(40, 30)
        self.zoom_fit_btn.clicked.connect(self.canvas.zoom_fit)
        
        self.zoom_in_btn = QtWidgets.QPushButton("+")
        self.zoom_in_btn.setFixedSize(30, 30)
        self.zoom_in_btn.clicked.connect(self.canvas.zoom_in)
        
        btn_layout.addWidget(self.zoom_out_btn)
        btn_layout.addWidget(self.zoom_fit_btn)
        btn_layout.addWidget(self.zoom_in_btn)
        
        # Add to main, aligned (margin for offset)
        layout.addWidget(self.toolbar_frame, 0, 0, Qt.AlignBottom | Qt.AlignRight)
        
        # Set margin for the toolbar itself so it's not flush
        layout.setContentsMargins(0, 0, 20, 20) 
        
        # Reset contents margins for the scroll area? No, Grid handles it.
        # But wait, setContentsMargins applies to the whole widget.
        # We want invalidation? No.
        # Better: Put scroll area at 0,0. Put Toolbar in a wrapper at 0,0 aligned.
        


class ImageSubWindow(QMdiSubWindow):
    def __init__(self, image_path, parent=None):
        super().__init__(parent)
        self.image_path = image_path
        self.setAttribute(Qt.WA_DeleteOnClose)
        
        self.scale_factor = 1.0
        self.original_pixmap = None
        
        # Scroll Area
        self.scroll_area = QtWidgets.QScrollArea()
        self.scroll_area.setWidgetResizable(True)
        self.setWidget(self.scroll_area)
        
        # Image Label
        self.image_label = QtWidgets.QLabel()
        self.image_label.setAlignment(Qt.AlignCenter)
        self.scroll_area.setWidget(self.image_label)
        
        self.load_image()
        
    def load_image(self):
        from PyQt5.QtGui import QPixmap
        self.original_pixmap = QPixmap(self.image_path)
        if not self.original_pixmap.isNull():
            self.image_label.setPixmap(self.original_pixmap)
        else:
            self.image_label.setText("Failed to load image.")

    def wheelEvent(self, event):
        if event.modifiers() & Qt.ControlModifier:
            delta = event.angleDelta().y()
            if delta > 0:
                self.zoom_in()
            else:
                self.zoom_out()
            event.accept()
        else:
            super().wheelEvent(event)

    def zoom_in(self):
        self.scale_factor *= 1.1
        self.update_image_size()

    def zoom_out(self):
        self.scale_factor /= 1.1
        if self.scale_factor < 0.1: self.scale_factor = 0.1
        self.update_image_size()

    def update_image_size(self):
        if self.original_pixmap and not self.original_pixmap.isNull():
            new_size = self.original_pixmap.size() * self.scale_factor
            self.image_label.setPixmap(
                self.original_pixmap.scaled(
                    new_size, Qt.KeepAspectRatio, Qt.SmoothTransformation
                )
            )

class PDFSubWindow(QMdiSubWindow):
    def __init__(self, pdf_path, parent=None):
        from PyQt5.QtWidgets import QVBoxLayout, QLabel, QScrollArea, QWidget
        from PyQt5.QtCore import Qt
        
        super().__init__(parent)
        self.pdf_path = pdf_path
        self.setAttribute(Qt.WA_DeleteOnClose)
        
        self.zoom_level = 1.5  # Initial zoom
        self.doc = None

        self.scroll_area = QScrollArea()
        self.scroll_area.setWidgetResizable(True)
        self.setWidget(self.scroll_area)

        self.container = QWidget()
        self.layout = QVBoxLayout(self.container)
        self.layout.setSpacing(20)
        self.layout.setAlignment(Qt.AlignCenter)
        self.scroll_area.setWidget(self.container)
        
        self.load_pdf()

    def load_pdf(self):
        try:
            import fitz  # PyMuPDF
            self.doc = fitz.open(self.pdf_path)
            self.render_pages()
        except Exception as e:
            err_lbl = QtWidgets.QLabel(f"Failed to load PDF: {str(e)}")
            self.layout.addWidget(err_lbl)

    def render_pages(self):
        if not self.doc:
            return

        import fitz
        from PyQt5.QtGui import QImage, QPixmap
        from PyQt5.QtWidgets import QLabel
        from PyQt5.QtCore import Qt

        # Clear existing widgets
        for i in reversed(range(self.layout.count())): 
            widget = self.layout.itemAt(i).widget()
            if widget is not None:
                widget.deleteLater()

        # Render each page
        for page_num in range(len(self.doc)):
            page = self.doc.load_page(page_num)
            pix = page.get_pixmap(matrix=fitz.Matrix(self.zoom_level, self.zoom_level))
            
            # Convert to QImage
            fmt = QImage.Format_RGB888
            if pix.alpha:
                fmt = QImage.Format_RGBA8888
                
            qimg = QImage(pix.samples, pix.width, pix.height, pix.stride, fmt)
            qpix = QPixmap.fromImage(qimg)
            
            lbl = QLabel()
            lbl.setPixmap(qpix)
            lbl.setAlignment(Qt.AlignCenter)
            lbl.setStyleSheet("border: 1px solid #ccc; background-color: white;")
            
            self.layout.addWidget(lbl)

    def wheelEvent(self, event):
        if event.modifiers() & Qt.ControlModifier:
            delta = event.angleDelta().y()
            if delta > 0:
                self.zoom_in()
            else:
                self.zoom_out()
            event.accept()
        else:
            super().wheelEvent(event)

    def zoom_in(self):
        self.zoom_level += 0.25
        if self.zoom_level > 5.0: self.zoom_level = 5.0
        self.render_pages()

    def zoom_out(self):
        self.zoom_level -= 0.25
        if self.zoom_level < 0.5: self.zoom_level = 0.5
        self.render_pages()

class CanvasSubWindow(QMdiSubWindow):
    def get_canvas(self):
        w = self.widget()
        if isinstance(w, OverlayContainer):
            return w.canvas
        if isinstance(w, QtWidgets.QScrollArea):
            return w.widget()
        return w

    def closeEvent(self, event):
        canvas = self.get_canvas()
        if canvas and hasattr(canvas, "is_modified"): 
            from src.canvas.commands import handle_close_event
            handle_close_event(canvas, event)
        else:
            event.accept()

class CanvasScreen(QMainWindow):
    def closeEvent(self, event):
        """Handle application close by attempting to close all tabs."""
        self.mdi_area.closeAllSubWindows()
        # If any subwindows remain (user cancelled save), ignore the close event
        if self.mdi_area.subWindowList():
            event.ignore()
        else:
            event.accept()

    def __init__(self):
        super().__init__()

        from src.menubar import MenuBarManager
        self.menu_manager = MenuBarManager(self)
        self._connect_menu_signals()

        container = QWidget()
        self.setCentralWidget(container)
        
        main_layout = QHBoxLayout(container)
        main_layout.setContentsMargins(0, 0, 0, 0)
        main_layout.setSpacing(0)

        # Splitter for Resizable Layout (Sidebar | Canvas)
        splitter = QSplitter(Qt.Horizontal)
        splitter.setHandleWidth(2)
        splitter.setStyleSheet("QSplitter::handle { background-color: #e2e8f0; }")

        self.library = ComponentLibrary(self)
        self.library.setMinimumWidth(200) # Reduced min width to allow more flex
        # self.library.setMinimumWidth(280) 
        
        self.mdi_area = QtWidgets.QMdiArea()
        self.mdi_area.setViewMode(QtWidgets.QMdiArea.TabbedView)
        self.mdi_area.setTabsClosable(True)
        self.mdi_area.setTabsMovable(True)
        self.mdi_area.setBackground(QBrush(QColor("#505050")))

        # Add to Splitter
        splitter.addWidget(self.library)
        splitter.addWidget(self.mdi_area)
        
        # Set Stretch: Library (0, keeps size), Canvas (1, takes rest)
        splitter.setStretchFactor(0, 0)
        splitter.setStretchFactor(1, 1)
        
        main_layout.addWidget(splitter)

        # Connect to theme manager for MDI area updates
        theme_manager.theme_changed.connect(self.apply_mdi_theme)
        
        # Apply initial MDI theme
        self.apply_mdi_theme(theme_manager.current_theme)

        apply_theme_to_screen(self)
        self._register_shortcuts()

    def _connect_menu_signals(self):
        self.menu_manager.new_project_clicked.connect(self.on_new_project)
        self.menu_manager.back_home_clicked.connect(self.on_back_home)
        self.menu_manager.back_home_clicked.connect(self.on_back_home)
        self.menu_manager.delete_clicked.connect(self.on_delete_component)
        self.menu_manager.logout_clicked.connect(self.logout)
        self.menu_manager.undo_clicked.connect(self.on_undo)
        self.menu_manager.redo_clicked.connect(self.on_redo)

        # Placeholders
        self.menu_manager.open_project_clicked.connect(self.on_open_file)
        self.menu_manager.save_project_clicked.connect(self.on_save_file)
        self.menu_manager.save_project_as_clicked.connect(self.on_save_as_file)
        self.menu_manager.generate_excel_clicked.connect(self.on_generate_excel)
        self.menu_manager.generate_report_clicked.connect(self.on_generate_report)
        self.menu_manager.add_symbols_clicked.connect(self.open_add_symbol_dialog)

    def apply_mdi_theme(self, theme):
        """Apply theme to MDI area title bar and tabs."""
        print(f"[CANVAS] Applying MDI theme: {theme}")
        
        if theme == "dark":
            mdi_stylesheet = """
                QMdiArea {
                    background-color: #0f172a;
                }
                
                /* Tab Bar Styling */
                QTabBar::tab {
                    background-color: #1e293b;
                    color: #cbd5e1;
                    border: 1px solid #334155;
                    border-bottom: none;
                    border-top-left-radius: 6px;
                    border-top-right-radius: 6px;
                    padding: 8px 16px;
                    margin-right: 2px;
                    font-size: 13px;
                }
                
                QTabBar::tab:selected {
                    background-color: #3b82f6;
                    color: #ffffff;
                    border-color: #3b82f6;
                    font-weight: bold;
                }
                
                QTabBar::tab:hover:!selected {
                    background-color: #334155;
                    color: #f1f5f9;
                }
                
                /* Subwindow styling */
                QMdiSubWindow {
                    background-color: #0f172a;
                }
            """
        else:  # light theme
            mdi_stylesheet = """
                QMdiArea {
                    background-color: #fffaf5;
                }
                
                /* Tab Bar Styling */
                QTabBar::tab {
                    background-color: #f4e8dc;
                    color: #3A2A20;
                    border: 1px solid #C97B5A;
                    border-bottom: none;
                    border-top-left-radius: 6px;
                    border-top-right-radius: 6px;
                    padding: 8px 16px;
                    margin-right: 2px;
                    font-size: 13px;
                }
                
                QTabBar::tab:selected {
                    background-color: #C97B5A;
                    color: #ffffff;
                    border-color: #C97B5A;
                    font-weight: bold;
                }
                
                QTabBar::tab:hover:!selected {
                    background-color: #ffffff;
                    color: #3A2A20;
                }
                
                /* Subwindow styling */
                QMdiSubWindow {
                    background-color: #fffaf5;
                }
            """
        
        self.mdi_area.setStyleSheet(mdi_stylesheet)
        # print(f"[CANVAS] MDI theme applied: {theme}")

    def on_new_project(self):
        canvas = CanvasWidget(self)
        canvas.update_canvas_theme()
        
        # Scroll Area Wrapper
        scroll = QtWidgets.QScrollArea()
        scroll.setWidget(canvas)
        scroll.setWidgetResizable(False) # Let canvas dictate size
        scroll.setAlignment(Qt.AlignCenter)
        scroll.setStyleSheet("QScrollArea { border: none; background: transparent; }")

        # Wrap in Overlay
        overlay = OverlayContainer(canvas, scroll)

        sub = CanvasSubWindow()
        sub.setWidget(overlay)
        sub.setAttribute(Qt.WA_DeleteOnClose)
        self.mdi_area.addSubWindow(sub)
        sub.setWindowTitle("New Project")
        sub.showMaximized()

    def open_add_symbol_dialog(self):
        from src.add_symbol_dialog import AddSymbolDialog
        dlg = AddSymbolDialog(self)
        # When dialog is accepted, refresh the library
        if dlg.exec_() == QtWidgets.QDialog.Accepted:
            self.library.reload_components()

    def on_back_home(self):
        slide_to_index(3, direction=-1)

    def _register_shortcuts(self):
        """Register cross-platform shortcuts for Add Symbol dialog."""

        # Windows/Linux -> Ctrl + A
        shortcut_ctrl_a = QShortcut(QKeySequence("Ctrl+A"), self)
        shortcut_ctrl_a.activated.connect(self.open_add_symbol_dialog)

        # macOS -> Cmd + A  (Meta key = Command key)
        shortcut_cmd_a = QShortcut(QKeySequence("Meta+A"), self)
        shortcut_cmd_a.activated.connect(self.open_add_symbol_dialog)

        # print("Shortcut registered: Ctrl+A / Cmd+A -> Add New Symbol")


    def on_delete_component(self):
        active_sub = self.mdi_area.currentSubWindow()
        if active_sub and isinstance(active_sub, CanvasSubWindow):
            active_sub.get_canvas().delete_selected_components()

    def on_undo(self):
        active_sub = self.mdi_area.currentSubWindow()
        if active_sub and isinstance(active_sub, CanvasSubWindow):
            active_sub.get_canvas().undo_stack.undo()

    def on_redo(self):
        active_sub = self.mdi_area.currentSubWindow()
        if active_sub and isinstance(active_sub, CanvasSubWindow):
            active_sub.get_canvas().undo_stack.redo()

    def on_generate_image(self):
        active_sub = self.mdi_area.currentSubWindow()
        if not active_sub or not isinstance(active_sub, CanvasSubWindow):
            return
            
        canvas = active_sub.get_canvas()
        options = QtWidgets.QFileDialog.Options()
        filename, _ = QtWidgets.QFileDialog.getSaveFileName(
            self, "Generate Image", "", 
            "JPEG Files (*.jpg);;PNG Files (*.png)", 
            options=options
        )
        
        if filename:
            canvas.export_to_image(filename)

    def on_generate_excel(self):
        active_sub = self.mdi_area.currentSubWindow()
        if not active_sub or not isinstance(active_sub, CanvasSubWindow):
            return
            
        canvas = active_sub.get_canvas()
        options = QtWidgets.QFileDialog.Options()
        filename, _ = QtWidgets.QFileDialog.getSaveFileName(
            self, "Generate Excel Report", "", 
            "Excel Files (*.xlsx)", 
            options=options
        )
        
        if filename:
            if not filename.lower().endswith(".xlsx"):
                filename += ".xlsx"
            try:
                canvas.export_to_excel(filename)
                QtWidgets.QMessageBox.information(self, "Success", f"Excel report saved to {filename}")
            except Exception as e:
                QtWidgets.QMessageBox.critical(self, "Error", f"Failed to generate excel:\n{str(e)}")
            
    def on_generate_report(self):
        active_sub = self.mdi_area.currentSubWindow()
        if not active_sub or not isinstance(active_sub, CanvasSubWindow):
            return
            
        canvas = active_sub.get_canvas()
        options = QtWidgets.QFileDialog.Options()
        filename, _ = QtWidgets.QFileDialog.getSaveFileName(
            self, "Generate PDF Report", "", 
            "PDF Files (*.pdf)", 
            options=options
        )
        
        if filename:
            if not filename.lower().endswith(".pdf"):
                filename += ".pdf"
            try:
                canvas.generate_report(filename)
                QtWidgets.QMessageBox.information(self, "Success", f"Report saved to {filename}")
            except Exception as e:
                QtWidgets.QMessageBox.critical(self, "Error", f"Failed to generate report:\n{str(e)}")

    def on_save_file(self):
        active_sub = self.mdi_area.currentSubWindow()
        if not active_sub or not isinstance(active_sub, CanvasSubWindow):
            QtWidgets.QMessageBox.information(self, "Information", "No file to save.")
            return
            
        canvas = active_sub.get_canvas()
        # If file already has a path, save directly
        if canvas.file_path:
            try:
                canvas.save_file(canvas.file_path)
                active_sub.setWindowTitle(f"Canvas - {os.path.basename(canvas.file_path)}")
                QtWidgets.QMessageBox.information(self, "Success", f"Project saved to {canvas.file_path}")
            except Exception as e:
                 QtWidgets.QMessageBox.critical(self, "Error", f"Failed to save file:\n{str(e)}")
        else:
            # Otherwise treat as Save As
            self.on_save_as_file()

    def on_save_as_file(self):
        active_sub = self.mdi_area.currentSubWindow()
        if not active_sub or not isinstance(active_sub, CanvasSubWindow):
             QtWidgets.QMessageBox.information(self, "Information", "No file to save.")
             return
             
        canvas = active_sub.get_canvas()
        options = QtWidgets.QFileDialog.Options()
        filename, filter_type = QtWidgets.QFileDialog.getSaveFileName(
            self, "Save Project As", "", 
            "Process Flow Diagram (*.pfd);;PDF Files (*.pdf);;JPEG Files (*.jpg)", 
            options=options
        )
        
        if not filename:
             return

        try:
            if filter_type.startswith("PDF") or filename.lower().endswith(".pdf"):
                if not filename.lower().endswith(".pdf"):
                    filename += ".pdf"
                canvas.export_to_pdf(filename)
                QtWidgets.QMessageBox.information(self, "Success", f"Exported to {filename}")
                
            elif filter_type.startswith("JPEG") or filename.lower().endswith(".jpg"):
                if not filename.lower().endswith(".jpg"):
                    filename += ".jpg"
                canvas.export_to_image(filename)
                QtWidgets.QMessageBox.information(self, "Success", f"Exported to {filename}")

            else:
                # Default to PFD
                if not filename.lower().endswith(".pfd"):
                    filename += ".pfd"
                canvas.save_file(filename)
                active_sub.setWindowTitle(f"Canvas - {os.path.basename(filename)}")
                QtWidgets.QMessageBox.information(self, "Success", f"Project saved to {filename}")

        except Exception as e:
            QtWidgets.QMessageBox.critical(self, "Error", f"Failed to save file:\n{str(e)}")

    def on_open_file(self):
        options = QtWidgets.QFileDialog.Options()
        filename, filter_type = QtWidgets.QFileDialog.getOpenFileName(
            self, "Open File", "", 
            "All Supported (*.pfd *.pdf *.jpg *.jpeg *.png);;Process Flow Diagram (*.pfd);;PDF Files (*.pdf);;Images (*.jpg *.jpeg *.png)", 
            options=options
        )
        
        if not filename:
            return False

        # PFD File -> Canvas
        if filename.lower().endswith(".pfd"):
            self.on_new_project() # Creates new tab/canvas
            
            # activeSubWindow might return None immediately after creation depending on focus
            active_sub = self.mdi_area.activeSubWindow()
            if not active_sub:
                # Fallback: Get the last added subwindow
                subs = self.mdi_area.subWindowList()
                if subs:
                    active_sub = subs[-1]
            
            if active_sub:
                canvas = active_sub.get_canvas()
                try:
                    if canvas.open_file(filename):
                        active_sub.setWindowTitle(f"Canvas - {os.path.basename(filename)}")
                    else:
                        QtWidgets.QMessageBox.warning(self, "Error", "Failed to load file. It might be corrupted or incompatible.")
                        active_sub.close()
                except Exception as e:
                    QtWidgets.QMessageBox.critical(self, "Error", f"Failed to open file:\n{str(e)}")
                    active_sub.close()
            else:
                 QtWidgets.QMessageBox.critical(self, "Error", "Failed to create new project window.")

        # Image File -> Image Viewer Tab
        elif filename.lower().endswith((".png", ".jpg", ".jpeg")):
            sub = ImageSubWindow(filename)
            self.mdi_area.addSubWindow(sub)
            sub.setWindowTitle(f"Image - {os.path.basename(filename)}")
            sub.showMaximized()

        # PDF File -> PDF Launcher Tab
        elif filename.lower().endswith(".pdf"):
            sub = PDFSubWindow(filename)
            self.mdi_area.addSubWindow(sub)
            sub.setWindowTitle(f"PDF - {os.path.basename(filename)}")
            sub.showMaximized()
            
        else:
             QtWidgets.QMessageBox.warning(self, "Error", "Unsupported file type.")
        
        return True

    def logout(self):
        app_state.access_token = None
        app_state.refresh_token = None
        app_state.current_user = None
        slide_to_index(0, direction=-1)

    def open_add_symbol_dialog(self):
        from src.add_symbol_dialog import AddSymbolDialog
        
        # CHANGED: Explicitly pass the current theme from the library
        current_theme = self.library.current_library_theme
        
        dlg = AddSymbolDialog(self, theme=current_theme)
        if dlg.exec_() == QtWidgets.QDialog.Accepted:
            self.library.reload_components()