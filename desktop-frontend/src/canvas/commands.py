"""
File operation and Undo/Redo commands for canvas.
"""
import os
from PyQt5.QtWidgets import QUndoCommand, QMessageBox, QFileDialog
from src.canvas.export import (
    save_to_pfd, load_from_pfd, 
    export_to_image, export_to_pdf, generate_report_pdf,
    export_to_excel
)

# ---------------------- UNDO COMMANDS ----------------------

class AddCommand(QUndoCommand):
    def __init__(self, canvas, component, pos):
        super().__init__()
        self.canvas = canvas
        self.component = component
        # Assuming pos is LOGICAL position passed from CanvasWidget
        self.component.logical_rect.moveTo(pos.x(), pos.y())
        if hasattr(self.canvas, "zoom_level"):
            self.component.update_visuals(self.canvas.zoom_level)
        self.setText(f"Add {component.config.get('component', 'Component')}")

    def redo(self):
        if self.component not in self.canvas.components:
            self.canvas.components.append(self.component)
            self.component.show()
            self.canvas.update()

    def undo(self):
        if self.component in self.canvas.components:
            self.canvas.components.remove(self.component)
            self.component.hide()
            self.canvas.update()

class AddConnectionCommand(QUndoCommand):
    def __init__(self, canvas, connection):
        super().__init__()
        self.canvas = canvas
        self.connection = connection
        self.setText("Add Connection")

    def redo(self):
        if self.connection not in self.canvas.connections:
            self.canvas.connections.append(self.connection)
            self.canvas.update()

    def undo(self):
        if self.connection in self.canvas.connections:
            self.canvas.connections.remove(self.connection)
            self.canvas.update()

class DeleteCommand(QUndoCommand):
    def __init__(self, canvas, components, connections):
        super().__init__()
        self.canvas = canvas
        self.components = components
        self.connections = connections
        self.setText(f"Delete {len(components)} items")

    def redo(self):
        for conn in self.connections:
            if conn in self.canvas.connections:
                self.canvas.connections.remove(conn)
        for comp in self.components:
            if comp in self.canvas.components:
                self.canvas.components.remove(comp)
                comp.hide()
        self.canvas.update()

    def undo(self):
        for comp in self.components:
            if comp not in self.canvas.components:
                self.canvas.components.append(comp)
                comp.show()
        for conn in self.connections:
            if conn not in self.canvas.connections:
                self.canvas.connections.append(conn)
        self.canvas.update()

class MoveCommand(QUndoCommand):
    def __init__(self, component, old_pos, new_pos):
        super().__init__()
        self.component = component
        self.old_pos = old_pos # Expecting LOGICAL pos
        self.new_pos = new_pos # Expecting LOGICAL pos
        self.setText(f"Move {component.config.get('component', 'Component')}")

    def redo(self):
        self.component.logical_rect.moveTo(self.new_pos.x(), self.new_pos.y())
        canvas = self.component.parent()
        z = canvas.zoom_level if hasattr(canvas, "zoom_level") else 1.0
        self.component.update_visuals(z)
        canvas.update()

    def undo(self):
        self.component.logical_rect.moveTo(self.old_pos.x(), self.old_pos.y())
        canvas = self.component.parent()
        z = canvas.zoom_level if hasattr(canvas, "zoom_level") else 1.0
        self.component.update_visuals(z)
        canvas.update()


# ---------------------- FILE OPERATIONS ----------------------
def save_project(canvas, filename):
    """Saves project and updates canvas state."""
    save_to_pfd(canvas, filename)
    canvas.file_path = filename
    canvas.undo_stack.setClean()
    # Force UI update and state sync
    canvas.set_modified(True)

def open_project(canvas, filename):
    """Opens project and updates canvas state."""
    if load_from_pfd(canvas, filename):
        canvas.file_path = filename
        canvas.undo_stack.clear()
        # Force UI update and state sync
        canvas.set_modified(True)
        return True
    return False

def handle_close_event(canvas, event):
    """Handles window close event with unsaved changes check."""
    if canvas.is_modified:
        reply = QMessageBox.question(
            canvas, 'Save Changes?',
            "There are unsaved changes in the current project.\nWould you like to save them before closing?",
            QMessageBox.Save | QMessageBox.Discard | QMessageBox.Cancel,
            QMessageBox.Save
        )

        if reply == QMessageBox.Save:
            if canvas.file_path:
                save_project(canvas, canvas.file_path)
                event.accept()
            else:
                options = QFileDialog.Options()
                filename, _ = QFileDialog.getSaveFileName(
                    canvas, "Save Project", "", 
                    "Process Flow Diagram (*.pfd)", 
                    options=options
                )
                if filename:
                    if not filename.lower().endswith(".pfd"):
                        filename += ".pfd"
                    save_project(canvas, filename)
                    event.accept()
                else:
                    event.ignore()
        elif reply == QMessageBox.Discard:
            event.accept()
        else:
            event.ignore()
    else:
        # No changes, close immediately
        event.accept()
def export_image(canvas, filename):
    export_to_image(canvas, filename)

def export_pdf(canvas, filename):
    export_to_pdf(canvas, filename)

def generate_report(canvas, filename):
    generate_report_pdf(canvas, filename)

def export_excel(canvas, filename):
    export_to_excel(canvas, filename)
