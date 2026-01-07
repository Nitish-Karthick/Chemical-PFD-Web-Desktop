import os
import csv 
import json
from PyQt5.QtWidgets import QWidget
from PyQt5.QtSvg import QSvgRenderer
from PyQt5.QtCore import Qt, QRectF, QPoint, QPointF
from PyQt5.QtGui import QPainter, QPen, QColor, QBrush, QColor, QPen

class ComponentWidget(QWidget):
    def __init__(self, svg_path, parent=None, config=None):
        super().__init__(parent)
        self.svg_path = svg_path
        self.config = config or {}
        self.renderer = QSvgRenderer(svg_path)

        # Standard component size
        self.setFixedSize(120, 100)

        self.hover_port = None
        self.is_selected = False
        self.drag_start_global = None
        
        self.rotation_angle = 0
        self.rotation_angle = 0
        self.drag_start_positions = {}
        
        # Logical Coordinates (True 100% scale geometry)
        # Initialize from current geometry or valid defaults
        self.logical_rect = QRectF(self.x(), self.y(), 120, 100)

        # Cache for grips to prevent file reading lag during paint events
        self._cached_grips = None
        
        # Cache for actual SVG render rectangle
        self._cached_svg_rect = None

        self.setAttribute(Qt.WA_Hover, True)
        self.setMouseTracking(True)

    def get_content_rect(self):
        bottom_pad = 25 if self.config.get('default_label') else 10
        w = max(1, self.width() - 20)
        h = max(1, self.height() - 10 - bottom_pad)
        return QRectF(10, 10, w, h)
    
    def calculate_svg_rect(self, content_rect):
        """Calculate the actual rectangle where SVG will be rendered"""
        view_box = self.renderer.viewBoxF()
        if view_box.isEmpty():
            return content_rect
        
        src_aspect = view_box.width() / view_box.height()
        dest_aspect = content_rect.width() / content_rect.height()

        target_rect = QRectF(content_rect)
        if src_aspect > dest_aspect:
            # SVG is wider than destination: fit to width
            new_h = content_rect.width() / src_aspect
            target_rect.setHeight(new_h)
            target_rect.moveTop(content_rect.top() + (content_rect.height() - new_h) / 2)
        else:
            # SVG is taller/same: fit to height
            new_w = content_rect.height() * src_aspect
            target_rect.setWidth(new_w)
            target_rect.moveLeft(content_rect.left() + (content_rect.width() - new_w) / 2)
        
        return target_rect
    
    def map_svg_to_widget_coords(self, svg_x_percent, svg_y_percent, svg_rect):
        """
        Map percentage coordinates from SVG viewBox space to widget screen space.
        The JSON grips use the SVG's internal coordinate system (0-100%).
        
        COORDINATE SYSTEM DETECTION:
        - Grip Editor outputs: Normal coords (low Y = top)
        - Legacy JSON: Inverted coords (high Y = top)
        
        We detect this by checking if grips cluster near extremes (0% or 100%)
        """
        view_box = self.renderer.viewBoxF()
        
        # Determine if we should invert Y based on the grip source
        should_invert = self._should_invert_y_axis()
        
        if view_box.isEmpty():
            # Fallback to simple mapping
            cx = svg_rect.x() + (svg_x_percent / 100.0) * svg_rect.width()
            if should_invert:
                cy = svg_rect.y() + svg_rect.height() - (svg_y_percent / 100.0) * svg_rect.height()
            else:
                cy = svg_rect.y() + (svg_y_percent / 100.0) * svg_rect.height()
            return QPointF(cx, cy)
        
        # Convert percentage to actual SVG viewBox coordinates
        svg_x = view_box.x() + (svg_x_percent / 100.0) * view_box.width()
        svg_y = view_box.y() + (svg_y_percent / 100.0) * view_box.height()
        
        # Calculate scale factors
        scale_x = svg_rect.width() / view_box.width()
        scale_y = svg_rect.height() / view_box.height()
        
        # Map to widget coordinates
        widget_x = svg_rect.x() + (svg_x - view_box.x()) * scale_x
        
        if should_invert:
            # Legacy JSON format (high Y = top visually)
            widget_y = svg_rect.y() + svg_rect.height() - (svg_y - view_box.y()) * scale_y
        else:
            # Modern Grip Editor format (low Y = top visually)
            widget_y = svg_rect.y() + (svg_y - view_box.y()) * scale_y
        
        return QPointF(widget_x, widget_y)
    
    def _should_invert_y_axis(self):
        """
        Detect if Y-axis should be inverted based on grip coordinates.
        
        COORDINATE SYSTEM RULES:
        
        LEGACY JSON (needs inversion):
        - Y=100 or Y>90 → Visual TOP
        - Y=0 or Y<10 → Visual BOTTOM
        - Y=50 → Visual MIDDLE
        
        MODERN GRIP EDITOR (no inversion):
        - Y=0 or Y<10 → Visual TOP
        - Y=100 or Y>90 → Visual BOTTOM
        - Y=50 → Visual MIDDLE
        
        DETECTION STRATEGY:
        1. If we have grips with Y≈100 marked as "top" → INVERT (legacy)
        2. If we have grips with Y≈0 marked as "top" → DON'T INVERT (modern)
        3. If we have grips with Y≈0 marked as "bottom" → INVERT (legacy)
        4. Otherwise use average: avg Y > 50 → INVERT
        """
        grips = self.get_grips()
        
        if not grips:
            return False
        
        # Check for side hints (most reliable)
        for grip in grips:
            y = grip.get("y", 50)
            side = grip.get("side", "")
            
            # Legacy format: Y=100 with side="top"
            if y >= 80 and side == "top":
                return True
            
            # Legacy format: Y=0 with side="bottom"
            if y <= 20 and side == "bottom":
                return True
            
            # Modern format: Y=0 with side="top"
            if y <= 20 and side == "top":
                return False
            
            # Modern format: Y=100 with side="bottom"
            if y >= 80 and side == "bottom":
                return False
        
        # Fallback: Check average Y
        y_values = [g.get("y", 50) for g in grips]
        avg_y = sum(y_values) / len(y_values)
        
        # If average is exactly 50, check for extreme values
        if 45 <= avg_y <= 55:
            has_high = any(y >= 90 for y in y_values)
            has_low = any(y <= 10 for y in y_values)
            
            # If we have both high and low extremes, it's likely legacy format
            if has_high and has_low:
                return True
        
        should_invert = avg_y > 50
        
        # Debug output for problematic components
        comp_name = self.config.get("name", "Unknown")
        debug_components = ["Butterfly Valve", "Float Valve", "Separators for Liquids, Decanter", 
                          "Fixed Roof Tank", "Jaw Crusher"]
        
        if any(name in comp_name for name in debug_components):
            print(f"[INVERT] {comp_name}:")
            print(f"  Grips: {[(g.get('x'), g.get('y'), g.get('side')) for g in grips]}")
            print(f"  Avg Y: {avg_y:.1f}, Should Invert: {should_invert}")
        
        return should_invert
    
    def load_grips_from_csv(self):
        """
        Load grips from Component_Details.csv using s_no for unique matching.
        Falls back to object name if s_no is not available.
        Returns a list, None, or False (False means "checked CSV but no valid grips").
        """
        # Priority 1: Match by s_no (most specific)
        s_no = self.config.get("s_no", "").strip()
        object_name = self.config.get("object", "").strip()
        
        if not s_no and not object_name:
            return None

        csv_path = os.path.join("ui", "assets", "Component_Details.csv")
        if not os.path.exists(csv_path):
            return None

        try:
            with open(csv_path, "r", encoding="utf-8-sig") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    matched = False
                    
                    # Try matching by s_no first (unique identifier)
                    if s_no and row.get("s_no", "").strip() == s_no:
                        matched = True
                    # Fallback: match by object name
                    elif not s_no and object_name and row.get("object", "").strip() == object_name:
                        matched = True
                    
                    if matched:
                        grips_str = row.get("grips", "").strip()
                        
                        # Check if grips field is empty or just "[]"
                        if not grips_str or grips_str == "[]" or grips_str == "":
                            print(f"[CSV] No grips for {self.config.get('name')} - will try JSON")
                            return False  # Signal: "CSV checked, but no valid grips"
                        
                        # Try to parse valid grips
                        try:
                            parsed = json.loads(grips_str.replace("'", '"'))
                            if isinstance(parsed, list) and len(parsed) > 0:
                                print(f"[CSV] ✓ Loaded grips for {self.config.get('name')} from CSV")
                                return parsed
                            else:
                                print(f"[CSV] Empty grips list for {self.config.get('name')} - will try JSON")
                                return False
                        except:
                            print(f"[CSV] Invalid JSON for {self.config.get('name')} - will try JSON")
                            return False
                            
        except Exception as e:
            print("[CSV ERROR]", e)

        return None  # Component not found in CSV


    def load_grips_from_json(self):
        """
        Load grips from grips.json.
        Used for standard components where CSV might be empty or missing grips.
        """
        json_path = os.path.join("ui", "assets", "grips.json")
        
        if not os.path.exists(json_path):
            return None

        try:
            with open(json_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                
            # Match current component name to 'component' field in JSON
            current_name = self.config.get("name", "").strip()

            for entry in data:
                if entry.get("component") == current_name:
                    grips = entry.get("grips")
                    if isinstance(grips, list) and len(grips) > 0:
                        print(f"[JSON] ✓ Loaded grips for {current_name} from grips.json")
                        return grips
                    else:
                        print(f"[JSON] Empty grips for {current_name}")
                        return None
                        
        except Exception as e:
            print("[GRIPS JSON ERROR]", e)
            return None
        
        return None

    def get_grips(self):
        """
        Centralized grip loading with priority:
        1. CSV grips (if present and valid)
        2. grips.json (if CSV is empty or component not in CSV)
        3. Config grips (if neither CSV nor JSON have grips)
        4. Default fallback grips
        """
        # Return cached value if available (Prevent Lag)
        if self._cached_grips is not None:
            return self._cached_grips
        
        grips = None
        grip_source = None
        
        # 1. Check CSV first
        csv_result = self.load_grips_from_csv()
        
        if csv_result is False:
            # CSV was checked but had no valid grips → try JSON
            grips = self.load_grips_from_json()
            grip_source = "JSON" if grips else None
        elif csv_result is not None:
            # CSV had valid grips → use them
            grips = csv_result
            grip_source = "CSV"
        else:
            # Component not in CSV → try JSON
            grips = self.load_grips_from_json()
            grip_source = "JSON" if grips else None

        # 2. If still no grips, try config
        if grips is None:
            cfg = self.config.get("grips")
            if isinstance(cfg, str):
                try:
                    grips = json.loads(cfg)
                    if isinstance(grips, list) and len(grips) > 0:
                        comp_name = self.config.get('name', 'Unknown')
                        # print(f"[CONFIG] ✓ Loaded grips for {comp_name} from config: {grips}")
                        grip_source = "CONFIG"
                except:
                    grips = None
            elif isinstance(cfg, list) and len(cfg) > 0:
                grips = cfg
                comp_name = self.config.get('name', 'Unknown')
                # print(f"[CONFIG] ✓ Loaded grips for {comp_name} from config: {grips}")
                grip_source = "CONFIG"

        # 3. Final fallback → default grips
        if grips is None or not isinstance(grips, list) or len(grips) == 0:
            print(f"[DEFAULT] Using default grips for {self.config.get('name')}")
            grips = [
                {"x": 0, "y": 50, "side": "left"},
                {"x": 100, "y": 50, "side": "right"},
            ]
            grip_source = "DEFAULT"
        
        # Debug: Print what grips were loaded and from where
        comp_name = self.config.get("name", "Unknown")
        if any(name in comp_name for name in ["Butterfly Valve", "Float Valve", "Separators", "Fixed Roof Tank"]):
            print(f"[GRIP DEBUG] {comp_name} loaded from {grip_source}: {grips}")

        # Save to cache
        self._cached_grips = grips
        return grips

    def paintEvent(self, event):
        painter = QPainter(self)
        painter.setRenderHint(QPainter.Antialiasing)

        # Selection Border
        if self.is_selected:
            painter.setPen(QPen(QColor("#60a5fa"), 2))
            painter.setBrush(Qt.NoBrush)
            painter.drawRoundedRect(self.rect().adjusted(1, 1, -1, -1), 8, 8)

        content_rect = self.get_content_rect()

        # Calculate actual SVG render rectangle
        svg_rect = self.calculate_svg_rect(content_rect)
        self._cached_svg_rect = svg_rect  # Cache it for grip calculations

        # DARK MODE ADAPTATION: Draw background plate if needed
        # Import inside method to avoid circular imports if any, or rely on global import
        import src.app_state as app_state
        if app_state.current_theme == "dark":
            painter.setBrush(QBrush(QColor("#e2e8f0"))) # Slate 200 (Light Gray)
            painter.setPen(Qt.NoPen)
            # Draw rounded rect slightly larger than SVG content
            # Or just fill the content rect?
            # Let's fill the content rect with some padding
            bg_rect = svg_rect.adjusted(-5, -5, 5, 5)
            painter.drawRoundedRect(bg_rect, 6, 6)

        # Render SVG
        self.renderer.render(painter, svg_rect)

        # Label
        if self.config.get('default_label'):
            label_color = Qt.white if app_state.current_theme == "dark" else Qt.black
            painter.setPen(QPen(label_color))
            text_rect = QRectF(0, content_rect.bottom() + 2, self.width(), 20)
            painter.drawText(text_rect, Qt.AlignCenter, self.config['default_label'])

        # Draw Ports using SVG coordinate mapping
        grips = self.get_grips()
        for idx, grip in enumerate(grips):
            self.draw_dynamic_port(painter, grip, idx, svg_rect)

    def draw_dynamic_port(self, painter, grip, idx, svg_rect):
        """Draw port based on SVG viewBox coordinate mapping"""
        pos = self.map_svg_to_widget_coords(grip["x"], grip["y"], svg_rect)
        center = QPoint(int(pos.x()), int(pos.y()))

        radius = 6 if self.hover_port == idx else 4
        color = QColor("#22c55e") if self.hover_port == idx else QColor("cyan")
        
        # Scale radius by zoom level to prevent "giant dots" at low zoom
        zoom = 1.0
        if self.parent() and hasattr(self.parent(), "zoom_level"):
            zoom = self.parent().zoom_level
            
        # Minimum visibility clamp (e.g., don't go below 2px)
        scaled_radius = max(2, int(radius * zoom))
        
        # If zoom is extremely low (< 0.3), maybe hide non-hovered ports?
        # User feedback: "grips only showing" - implying component is gone.
        # But reducing grip size will help clutter.
        
        painter.setBrush(color)
        painter.setPen(Qt.NoPen)
        painter.drawEllipse(center, scaled_radius, scaled_radius)

    def get_grip_position(self, idx):
        """Get grip position using SVG coordinate mapping"""
        grips = self.get_grips()

        if 0 <= idx < len(grips):
            grip = grips[idx]
            
            # Use cached SVG rect if available, otherwise calculate
            if self._cached_svg_rect:
                svg_rect = self._cached_svg_rect
            else:
                content_rect = self.get_content_rect()
                svg_rect = self.calculate_svg_rect(content_rect)
            
            pos = self.map_svg_to_widget_coords(grip["x"], grip["y"], svg_rect)
            return QPoint(int(pos.x()), int(pos.y()))

        return QPoint(0, 0)

    def get_logical_grip_position(self, idx):
        """Get grip position in LOGICAL coordinates (unscaled)."""
        grips = self.get_grips()

        if 0 <= idx < len(grips):
            grip = grips[idx]
            
            # Calculate Logical Content Rect
            # Replicate get_content_rect logic but using logical size
            l_w = self.logical_rect.width()
            l_h = self.logical_rect.height()
            
            bottom_pad = 25 if self.config.get('default_label') else 10
            w = max(1, l_w - 20)
            h = max(1, l_h - 10 - bottom_pad)
            
            logical_content_rect = QRectF(10, 10, w, h)
            
            # Calculate Logical SVG Rect
            logical_svg_rect = self.calculate_svg_rect(logical_content_rect)
            
            # Map to coordinates
            pos = self.map_svg_to_widget_coords(grip["x"], grip["y"], logical_svg_rect)
            return QPointF(pos.x(), pos.y())

        return QPointF(0, 0)

    # SELECTION
    def set_selected(self, selected: bool):
        self.is_selected = selected
        self.update()

    # MOUSE PRESS
    def mousePressEvent(self, event):
        if event.button() == Qt.LeftButton:

            # FIRST: CHECK IF CLICKED A PORT – START A CONNECTION
            if self.hover_port is not None:
                if hasattr(self.parent(), "start_connection"):
                    grips = self.get_grips()
                    side = grips[self.hover_port].get("side", "right")
                    self.parent().start_connection(self, self.hover_port, side)
                    self.parent().setFocus()
                    event.accept()
                    return

            # SELECTION HANDLING
            ctrl = bool(event.modifiers() & Qt.ControlModifier)
            if hasattr(self.parent(), "handle_selection"):
                self.parent().handle_selection(self, ctrl)
            else:
                self.is_selected = True
                self.update()

            if self.parent():
                self.parent().setFocus()

            # PREPARE DRAG
            self.drag_start_global = event.globalPos()
            
            # Record start positions for Undo
            if self.parent() and hasattr(self.parent(), "components"):
                self.drag_start_positions = {
                    c: c.pos() for c in self.parent().components if c.is_selected
                }

            event.accept()
        else:
            super().mousePressEvent(event)

    # MOUSE MOVE
    def mouseMoveEvent(self, event):
        # If drawing connection, forward movement to canvas
        if hasattr(self.parent(), "active_connection") and self.parent().active_connection:
            g = self.mapToGlobal(event.pos())
            parent_pos = self.parent().mapFromGlobal(g)
            if hasattr(self.parent(), "update_connection_drag"):
                # Must convert to LOGICAL coordinates for the canvas
                if hasattr(self.parent(), "get_logical_pos"):
                    logical_pos = self.parent().get_logical_pos(parent_pos)
                    self.parent().update_connection_drag(logical_pos)
                else:
                    self.parent().update_connection_drag(parent_pos)
            return

        # PORT HOVER DETECTION using SVG coordinate mapping
        pos = event.pos()
        prev = self.hover_port
        self.hover_port = None

        grips = self.get_grips()
        
        # Use cached SVG rect if available
        if self._cached_svg_rect:
            svg_rect = self._cached_svg_rect
        else:
            content_rect = self.get_content_rect()
            svg_rect = self.calculate_svg_rect(content_rect)

        for idx, grip in enumerate(grips):
            grip_pos = self.map_svg_to_widget_coords(grip["x"], grip["y"], svg_rect)
            center = QPoint(int(grip_pos.x()), int(grip_pos.y()))

            if (pos - center).manhattanLength() < 10:
                self.hover_port = idx
                break

        if prev != self.hover_port:
            self.update()

        # DRAGGING
        if event.buttons() & Qt.LeftButton and self.drag_start_global:
            curr_global = event.globalPos()
            delta = curr_global - self.drag_start_global

            parent = self.parent()
            if parent and hasattr(parent, "components"):
                # move all selected
                for comp in parent.components:
                    if comp.is_selected:
                        # Update LOGICAL position
                        # new_pos is visual. Convert to logical.
                        z = parent.zoom_level if hasattr(parent, "zoom_level") else 1.0
                        
                        # We calculate delta in logical space
                        logical_delta = delta / z
                        
                        # Update logical rect position
                        comp.logical_rect.translate(logical_delta.x(), logical_delta.y())
                        
                        # Update visuals from logical
                        comp.update_visuals(z)
                        
                        # Auto-Expand
                        if hasattr(parent, "expand_to_contain"):
                            parent.expand_to_contain(comp.logical_rect)
                        
                parent.update()
            else:
                 # Single item move (fallback)
                 z = self.parent().zoom_level if (self.parent() and hasattr(self.parent(), "zoom_level")) else 1.0
                 new_pos = self.pos() + delta
                 
                 # Update logical
                 self.logical_rect.moveTo(new_pos.x() / z, new_pos.y() / z)
                 self.update_visuals(z)
                 
                 if self.parent(): self.parent().update()

            self.drag_start_global = curr_global

    # MOUSE RELEASE
    def mouseReleaseEvent(self, event):
        # Forward release during connection building
        if hasattr(self.parent(), "active_connection") and self.parent().active_connection:
            g = self.mapToGlobal(event.pos())
            parent_pos = self.parent().mapFromGlobal(g)
            if hasattr(self.parent(), "handle_connection_release"):
                # Use Logical
                if hasattr(self.parent(), "get_logical_pos"):
                    logical_pos = self.parent().get_logical_pos(parent_pos)
                    self.parent().handle_connection_release(logical_pos)
                else:
                    self.parent().handle_connection_release(parent_pos)
                
        # UNDOABLE MOVE 
        if hasattr(self, "drag_start_positions") and self.drag_start_positions:
            from src.canvas.commands import MoveCommand
            
            stack = self.parent().undo_stack
            moved_items = []
            
            for comp, start_pos in self.drag_start_positions.items():
                if comp.pos() != start_pos:
                    moved_items.append((comp, start_pos, comp.pos()))
            
            if moved_items:
                stack.beginMacro("Move Components")
                for comp, start, end in moved_items:
                    cmd = MoveCommand(comp, start, end)
                    stack.push(cmd)
                stack.endMacro()
            
            self.drag_start_positions = {}


    # ---------------------- SERIALIZATION ----------------------
    # ---------------------- ZOOM LOGIC ----------------------
    def update_visuals(self, zoom_level):
        """Update visual geometry based on logical rect and zoom level."""
        # Calculate visual rect
        v_x = int(self.logical_rect.x() * zoom_level)
        v_y = int(self.logical_rect.y() * zoom_level)
        v_w = int(self.logical_rect.width() * zoom_level)
        v_h = int(self.logical_rect.height() * zoom_level)
        
        # Apply
        self.setFixedSize(v_w, v_h)
        self.move(v_x, v_y)

    # ---------------------- SERIALIZATION ----------------------
    def to_dict(self):
        return {
            "x": int(self.logical_rect.x()),
            "y": int(self.logical_rect.y()),
            "width": int(self.logical_rect.width()),
            "height": int(self.logical_rect.height()),
            "rotation": self.rotation_angle,
            "svg_path": self.svg_path,
            "config": self.config
        }