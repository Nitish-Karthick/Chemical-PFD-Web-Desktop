import os
from PyQt5 import QtWidgets
from PyQt5.QtCore import Qt, QPoint, QPointF
from PyQt5.QtGui import QPainter, QColor, QPen
from PyQt5.QtWidgets import QMainWindow, QWidget, QVBoxLayout, QLabel

from src.component_library import ComponentLibrary
from src.component_widget import ComponentWidget
import src.app_state as app_state
from src.theme import apply_theme_to_screen

import json

class CanvasWidget(QWidget):
    """Simple canvas area that accepts drops and places basic widgets."""
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setObjectName("canvasArea")
        self.setAcceptDrops(True)
        self.setStyleSheet("""
            QWidget#canvasArea {
                background: transparent;
            }
        """)
        # No layout - we handle manual positioning
        # layout = QVBoxLayout(self)
        # layout.setContentsMargins(0,0,0,0)
        self.setSizePolicy(QtWidgets.QSizePolicy.Expanding, QtWidgets.QSizePolicy.Expanding)
        # self.setAttribute(Qt.WA_StyledBackground, True) # Removed debug attribute
        
        # Keep references to prevent GC
        self.components = []
        self.connections = [] # List of Connection objects
        self.active_connection = None 
        self.setMouseTracking(True) # Ensure tracking for drawing lines
        self.setFocusPolicy(Qt.StrongFocus) # Enable Keyboard Events

        # Load component configuration (grips, labels)
        self.component_config = {}
        self._load_config()
        
        # Load label generation data
        self.label_data = {} # { "cleaned_name": {legend, suffix, count} }
        self._load_label_data()

    def _load_label_data(self):
        import csv
        try:
            base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            csv_path = os.path.join(base_dir, "ui", "assets", "Component_Details.csv")
            
            with open(csv_path, 'r', encoding='utf-8-sig') as f: # utf-8-sig to handle BOM if any
                reader = csv.DictReader(f)
                for row in reader:
                    # Key by 'object' column (e.g. GateValve) for robust matching
                    # Also normalize keys
                    key = row.get('object', '').strip()
                    if not key: key = row.get('name', '').strip() # Fallback
                    
                    self.label_data[self._clean_string(key)] = {
                        'legend': row.get('legend', '').strip(),
                        'suffix': row.get('suffix', '').strip(),
                        'count': 0
                    }
        except Exception as e:
            print(f"Failed to load Component_Details.csv: {e}")

    def _clean_string(self, s):
        return s.lower().translate(str.maketrans('', '', ' ,_/-()'))

    def _load_config(self):
        try:
            base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            json_path = os.path.join(base_dir, "ui", "assets", "grips.json")
            
            with open(json_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                for item in data:
                    self.component_config[item['component']] = item
        except Exception as e:
            print(f"Failed to load grips.json: {e}")
        
    def dragEnterEvent(self, event):
        if event.mimeData().hasText():
            event.acceptProposedAction()
        else:
            event.ignore()

    def dropEvent(self, event):
        text = event.mimeData().text()
        pos = event.pos()
        self.add_component_label(text, pos)
        event.acceptProposedAction()

    def mousePressEvent(self, event):
        if event.button() == Qt.LeftButton:
            # 1. Deselect everything first
            self.deselect_all()
            
            # 2. Check for Connection Hits
            hit_connection = None
            hit_seg_idx = -1
            for conn in self.connections:
                idx = conn.hit_test(event.pos())
                if idx != -1:
                    hit_connection = conn
                    hit_seg_idx = idx
                    break
            
            if hit_connection:
                hit_connection.is_selected = True
                self.drag_connection = hit_connection
                self.drag_start_pos = event.pos()
                
                # --- AUTO-DETECT WHICH PARAMETER TO ADJUST ---
                # We have 3 params: path_offset, start_adjust, end_adjust.
                # Which one affects the clicked segment the most?
                
                best_param = "path_offset"
                best_sensitivity = QPointF(0,0)
                best_mag_sq = -1.0
                
                # Check each parameter
                params = ["path_offset", "start_adjust", "end_adjust"]
                base_points = list(hit_connection.path) # Snapshot
                
                for param in params:
                    # perturb
                    old_val = getattr(hit_connection, param)
                    setattr(hit_connection, param, old_val + 1.0)
                    
                    hit_connection.calculate_path()
                    new_points = hit_connection.path
                    
                    # Measure movement of hit segment center
                    sens = QPointF(0,0)
                    if hit_seg_idx < len(base_points) - 1 and hit_seg_idx < len(new_points) - 1:
                         base_mid = (base_points[hit_seg_idx] + base_points[hit_seg_idx+1]) / 2.0
                         new_mid = (new_points[hit_seg_idx] + new_points[hit_seg_idx+1]) / 2.0
                         sens = new_mid - base_mid
                    
                    # Restore
                    setattr(hit_connection, param, old_val)
                    
                    mag_sq = sens.x()**2 + sens.y()**2
                    if mag_sq > best_mag_sq:
                        best_mag_sq = mag_sq
                        best_sensitivity = sens
                        best_param = param
                
                # Restore clean state
                hit_connection.path = list(base_points)
                hit_connection.calculate_path() 
                
                self.drag_param_name = best_param
                self.drag_sensitivity = best_sensitivity
                self.drag_start_param_val = getattr(hit_connection, best_param)
                
                self.setFocus()
                self.update()
                event.accept()
                return

        # Fallback: Clicked blank space
        self.deselect_all()
        self.active_connection = None
        self.drag_connection = None # FIX: Clear drag state to prevent sticky dragging
        self.setFocus() 
        event.accept()

    def mouseMoveEvent(self, event):
        # 1. Creating a new connection?
        if self.active_connection:
            self.update_connection_drag(event.pos())
            super().mouseMoveEvent(event)
            return

        # 2. Dragging an existing connection (Adjustment)?
        if hasattr(self, 'drag_connection') and self.drag_connection:
            delta = event.pos() - self.drag_start_pos
            
            # Use Gradient Projection with the chosen parameter
            sens_sq = self.drag_sensitivity.x()**2 + self.drag_sensitivity.y()**2
            
            if sens_sq > 0.001: 
                # Dot product
                dot = delta.x() * self.drag_sensitivity.x() + delta.y() * self.drag_sensitivity.y()
                change = dot / sens_sq
                
                new_val = self.drag_start_param_val + change
                setattr(self.drag_connection, self.drag_param_name, new_val)
                
                self.drag_connection.calculate_path()
                self.update()
                
        super().mouseMoveEvent(event)

    def update_connection_drag(self, pos):
        """Updates the active connection state during a drag, including magnetic snapping."""
        if not self.active_connection:
            return

        # --- Magnetic Snapping Logic ---
        snap_found = False
        for comp in self.components:
            # Optimization: Check bounding rect proximity first
            # Use a slightly larger padded rect for loose check
            if not comp.geometry().adjusted(-30, -30, 30, 30).contains(pos):
                continue
                
            content_rect = comp.get_content_rect()
            grips = comp.config.get('grips')
            if not grips:
                    grips = [
                    {'x': 0, 'y': 50, 'side': 'left'},
                    {'x': 100, 'y': 50, 'side': 'right'}
                ]
                
            for idx, grip in enumerate(grips):
                cx = content_rect.x() + (grip['x'] / 100.0) * content_rect.width()
                cy = content_rect.y() + (grip['y'] / 100.0) * content_rect.height()
                center = comp.mapToParent(QPoint(int(cx), int(cy)))
                
                # Snap distance
                if (pos - center).manhattanLength() < 20: 
                    if comp != self.active_connection.start_component:
                        self.active_connection.set_snap_target(comp, idx, grip.get('side', 'left'))
                        snap_found = True
                        break
            if snap_found: break
        
        if not snap_found:
            self.active_connection.clear_snap_target()
            self.active_connection.current_pos = pos
        # -------------------------------

        self.active_connection.calculate_path(self.components) # Recalculate dynamic path with obstacles
        self.update() # Trigger redraw

    def mouseReleaseEvent(self, event):
        self.handle_connection_release(event.pos())
        self.drag_connection_start = None # Reset drag
        self.drag_connection = None # Reset Smart Drag
        super().mouseReleaseEvent(event)

    def keyPressEvent(self, event):
        if event.key() == Qt.Key_Delete or event.key() == Qt.Key_Backspace:
            self.delete_selected_components()
        else:
            super().keyPressEvent(event)

    def delete_selected_components(self):
        """Deletes selected components and selected connections."""
        # 1. Delete Selected Components
        to_delete_comps = [comp for comp in self.components if comp.is_selected]
        
        # 2. Delete Selected Connections (Independent selection)
        to_delete_conns = [conn for conn in self.connections if conn.is_selected]

        if not to_delete_comps and not to_delete_conns:
            return

        # Remove connections attached to deleted components
        for i in range(len(self.connections) - 1, -1, -1):
            conn = self.connections[i]
            should_remove = False
            
            # Case A: Attached to deleted component
            if conn.start_component in to_delete_comps or conn.end_component in to_delete_comps:
                should_remove = True
            
            # Case B: Explicitly selected
            if conn in to_delete_conns:
                should_remove = True
                
            if should_remove:
                self.connections.pop(i)
        
        # Remove Components
        for comp in to_delete_comps:
            if comp in self.components:
                self.components.remove(comp)
            comp.deleteLater()
            
        self.update()

    def handle_connection_release(self, pos):
        if self.active_connection:
            # Check if we have a valid snap target
            if self.active_connection.snap_component:
                self.active_connection.set_end_grip(
                    self.active_connection.snap_component,
                    self.active_connection.snap_grip_index,
                    self.active_connection.snap_side
                )
                self.active_connection.calculate_path(self.components)
                self.connections.append(self.active_connection)
            
            self.active_connection = None
            self.update()

    def paintEvent(self, event):
        from PyQt5.QtGui import QPainter, QPen
        from PyQt5.QtCore import Qt

        painter = QPainter(self)
        painter.setRenderHint(QPainter.Antialiasing)

        # Draw Connections
        
        # 1. Finished Connections
        for conn in self.connections:
            # Recalculate path in case components moved
            # Optimization: Only recalc if dirty? For now, always to support live updates.
            conn.calculate_path(self.components)
            
            # Choose Pen based on selection
            if conn.is_selected:
                painter.setPen(QPen(QColor("#2563eb"), 3)) # Blue, thicker
            else:
                painter.setPen(QPen(Qt.black, 2))
                
            if len(conn.path) > 1:
                for i in range(len(conn.path) - 1):
                    painter.drawLine(conn.path[i], conn.path[i+1])
                    
            # Draw Handles for selected connections
            if conn.is_selected:
                painter.setBrush(QColor("#2563eb"))
                painter.setPen(Qt.NoPen)
                for pt in conn.path:
                    painter.drawEllipse(pt, 4, 4)

        # 2. Active Connection (dashed)
        if self.active_connection:
            pen = QPen(Qt.black, 2, Qt.DashLine)
            painter.setPen(pen)
            path = self.active_connection.path
            if len(path) > 1:
                for i in range(len(path) - 1):
                    painter.drawLine(path[i], path[i+1])

    def start_connection(self, component, grip_index, side):
        from src.connection import Connection
        self.active_connection = Connection(component, grip_index, side)
        self.active_connection.current_pos = component.mapToParent(component.get_grip_position(grip_index))
        self.active_connection.calculate_path()
        self.update()

    def deselect_all(self):
        """Deselects all ComponentWidgets and Connections."""
        # Use our tracked list instead of findChildren for reliability
        for comp in self.components:
            comp.set_selected(False)
        for conn in self.connections:
            conn.is_selected = False
        self.update()

    def handle_selection(self, component, add_to_selection=False):
        """Handles selection logic."""
        if add_to_selection:
            # Toggle this one (Cumulative)
            component.set_selected(not component.is_selected)
        else:
            # Exclusive selection
            # Simplification: ALWAYS deselect others. 
            # This fixes the 'stuck selection' bug user reported.
            self.deselect_all()
            component.set_selected(True)

    def add_component_label(self, text, pos: QPoint):
        """Creates a ComponentWidget at the drop position with auto-generated label."""
        svg_path = self.find_svg_for_component(text)
        
        # 1. Generate Label
        clean_key = self._clean_string(text)
        label_text = text # Default fallback
        
        # Try to find in label_data
        if clean_key in self.label_data:
            data = self.label_data[clean_key]
            data['count'] += 1
            count_str = f"{data['count']:02d}"
            # Format: Legend + Count + Suffix
            # Handle empty fields gracefully
            legend = data['legend']
            suffix = data['suffix']
            label_text = f"{legend}{count_str}{suffix}"
        else:
            # Try fuzzy match if direct fail
            # (Reuse existing fuzzy match logic if needed, but simplistic for now)
            pass

        # Look up config (robust fuzzy match)
        config = self.get_component_config(text)
        if not config: config = {}
        
        # Assign the generated label
        config['default_label'] = label_text

        if not svg_path:
            # Fallback to text label if no SVG found
            lbl = QLabel(label_text, self)
            lbl.setAttribute(Qt.WA_TransparentForMouseEvents, False)
            lbl.move(pos)
            lbl.setStyleSheet("color: white; background: rgba(0,0,0,0.5); padding: 5px; border-radius: 4px;")
            lbl.show()
            lbl.adjustSize()
            return

        comp = ComponentWidget(svg_path, self, config=config)
        comp.move(pos)
        comp.show()
        self.components.append(comp) # Keep reference

    def get_component_config(self, name):
        """Finds config by fuzzy matching name against loaded keys."""
        # 0. Apply same ID MAP as SVG finder
        ID_MAP = {
            'Exchanger905': "905Exchanger",
            'KettleReboiler907': "907Kettle Reboiler",
            'OneCellFiredHeaterFurnace': "One Cell Fired Heater", 
            'TwoCellFiredHeaterFurnace': "Two Cell Fired Heater",
            'OilGasOrPulverizedFuelFurnace': "Oil Gas or Pulverized Fuel Furnace"
        }
        name = ID_MAP.get(name, name)

        # 1. Exact match
        if name in self.component_config:
            return self.component_config[name]

        # 2. Fuzzy match
        # Reuse robust cleaning logic
        def clean_string(s):
            return s.lower().translate(str.maketrans('', '', ' ,_/-()'))
            
        target = clean_string(name)
        
        for key, data in self.component_config.items():
            if clean_string(key) == target:
                # print(f"Fuzzy config match: '{name}' -> '{key}'")
                return data
                
        # print(f"No config found for: '{name}'")
        return {}

    def find_svg_for_component(self, name):
        """Recursively search for an SVG matching the component name in ui/assets/svg."""
        
        # 1. Handle Known ID Mappings (legacy inconsistencies)
        ID_MAP = {
            'Exchanger905': "905Exchanger",
            'KettleReboiler907': "907Kettle Reboiler",
            'OneCellFiredHeaterFurnace': "One Cell Fired Heater, Furnace",
            'TwoCellFiredHeaterFurnace': "Two Cell Fired Heater, Furnace"
        }
        name = ID_MAP.get(name, name)

        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        svg_dir = os.path.join(base_dir, "ui", "assets", "svg")
        
        if not os.path.exists(svg_dir):
            print(f"Assets directory not found: {svg_dir}")
            return None

        # 2. Robust Fuzzy Match Helper
        def clean_string(s):
            # Remove spaces, commas, special chars, lowercase, including parens
            return s.lower().translate(str.maketrans('', '', ' ,_/-()'))

        search_target = clean_string(name)
        
        for root, dirs, files in os.walk(svg_dir):
            for filename in files:
                if not filename.lower().endswith(".svg"):
                    continue
                
                # Check exact match first
                if filename == f"{name}.svg":
                    return os.path.join(root, filename)
                
                # Check fuzzy match
                file_stem = filename.rsplit('.', 1)[0]
                if clean_string(file_stem) == search_target:
                    return os.path.join(root, filename)
                
        return None


class CanvasScreen(QMainWindow):
    """
    QMainWindow so we can attach docks (ComponentLibrary) easily.
    We'll embed a central QWidget named 'bgwidget' so theme.apply works.
    """
    def __init__(self):
        super().__init__()

        # central container (bgwidget) so theme.apply_theme_to_screen can find it
        central = QWidget()
        central.setObjectName("bgwidget")
        self.setCentralWidget(central)

        # layout for central area
        central_layout = QVBoxLayout(central)
        central_layout.setContentsMargins(0,0,0,0)

        # actual canvas
        self.canvas = CanvasWidget(self)
        central_layout.addWidget(self.canvas)

        # Create and add the component library (dock)
        self.library = ComponentLibrary(self)
        # library is a QDockWidget already
        self.addDockWidget(Qt.LeftDockWidgetArea, self.library)

        # allow floating / moving and max width
        self.library.setFeatures(self.library.features() | QtWidgets.QDockWidget.DockWidgetClosable)
        # If you want library initially collapsed or hidden:
        # self.library.hide()

        # Apply theme (theme module expects a child named 'bgwidget')
        apply_theme_to_screen(self)


    # Helper: expose a method to programmatically toggle the dock visibility
    def toggle_library(self, show: bool):
        self.library.setVisible(show)
