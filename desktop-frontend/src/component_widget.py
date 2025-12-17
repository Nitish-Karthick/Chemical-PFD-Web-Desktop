
import os
from PyQt5.QtWidgets import QWidget
from PyQt5.QtSvg import QSvgRenderer
from PyQt5.QtCore import Qt, QRectF, QPoint
from PyQt5.QtGui import QPainter, QColor, QPen

class ComponentWidget(QWidget):
    def __init__(self, svg_path, parent=None, config=None):
        super().__init__(parent)
        self.svg_path = svg_path
        self.config = config or {} # Store config
        self.renderer = QSvgRenderer(svg_path)
        
        # Fixed size for standardized components, or could be dynamic
        self.setFixedSize(100, 80) 
        
        self.hover_port = None  # Now stores index or ID of grip
        self.is_selected = False
        
        self.setAttribute(Qt.WA_Hover, True)  # Enable hover events
        self.setMouseTracking(True) # REQUIRED for hover events without clicking
        self.drag_start_global = None

    def get_content_rect(self):
        # Define the area where SVG and Ports live
        # Padding: left=10, top=10, right=10
        # Bottom padding depends on label
        bottom_pad = 25 if self.config.get('default_label') else 10
        
        # Ensure we have minimum space
        w = max(1, self.width() - 20)
        h = max(1, self.height() - 10 - bottom_pad)
        
        return QRectF(10, 10, w, h)

    def paintEvent(self, event):
        painter = QPainter(self)
        painter.setRenderHint(QPainter.Antialiasing)
        
        # 1. Draw Selection Border (if selected)
        if self.is_selected:
            painter.setPen(QPen(QColor("#60a5fa"), 2, Qt.SolidLine))
            painter.setBrush(Qt.NoBrush)
            painter.drawRoundedRect(self.rect().adjusted(1,1,-1,-1), 8, 8)
            
        # 2. Get Consistent Content Rect
        content_rect = self.get_content_rect()
        
        # 3. Draw SVG Content
        self.renderer.render(painter, content_rect)
        
        # 4. Draw Default Label
        if self.config.get('default_label'):
            painter.setPen(QPen(Qt.black))
            text_rect = QRectF(0, content_rect.bottom() + 2, self.width(), 20)
            painter.drawText(text_rect, Qt.AlignCenter, self.config['default_label'])

        # 5. Draw Dynamic Ports
        grips = self.config.get('grips')
        
        if not grips:
            # FALLBACK: If no grips defined (or empty list), show default Left/Right ports
            # But only if it's NOT an explicitly empty list intended to have no grips?
            # User said "only few have grips", implies they WANT grips.
            # Let's assume if it's missing or empty, we default to Left/Right for utility.
            grips = [
                {'x': 0, 'y': 50, 'side': 'left'},
                {'x': 100, 'y': 50, 'side': 'right'}
            ]
            
        for idx, grip in enumerate(grips):
            self.draw_dynamic_port(painter, grip, idx, content_rect)
        
    def draw_dynamic_port(self, painter, grip, idx, content_rect):
        # Calculate pixel position relative to CONTENT RECT
        # grip['x'] is percentage of content_rect.width()
        # grip['y'] is percentage of content_rect.height()
        
        cx = content_rect.x() + (grip['x'] / 100.0) * content_rect.width()
        cy = content_rect.y() + (grip['y'] / 100.0) * content_rect.height()
        center = QPoint(int(cx), int(cy))
        
        radius = 4
        color = QColor("cyan") 
        
        # Highlight if hovered
        if self.hover_port == idx:
            color = QColor("#22c55e") # Green on hover
            radius = 6 # Slightly larger
            
        painter.setBrush(color)
        painter.setPen(Qt.NoPen)
        painter.drawEllipse(center, radius, radius)

    def set_selected(self, selected: bool):
        self.is_selected = selected
        self.update()

    def get_grip_position(self, idx):
        """Returns the QPoint of the grip in LOCAL widget coordinates."""
        grips = self.config.get('grips')
        if not grips:
             grips = [
                {'x': 0, 'y': 50, 'side': 'left'},
                {'x': 100, 'y': 50, 'side': 'right'}
            ]
        
        if 0 <= idx < len(grips):
            grip = grips[idx]
            content_rect = self.get_content_rect()
            cx = content_rect.x() + (grip['x'] / 100.0) * content_rect.width()
            cy = content_rect.y() + (grip['y'] / 100.0) * content_rect.height()
            return QPoint(int(cx), int(cy))
        return QPoint(0,0)

    def mousePressEvent(self, event):
        if event.button() == Qt.LeftButton:
            # 0. Check if clicking on a Grip (Port)
            if self.hover_port is not None:
                # Start Connection
                if hasattr(self.parent(), "start_connection"):
                    grips = self.config.get('grips')
                    # Fallback grips logic
                    if not grips:
                        grips = [
                            {'x': 0, 'y': 50, 'side': 'left'},
                            {'x': 100, 'y': 50, 'side': 'right'}
                        ]
                    side = grips[self.hover_port].get('side', 'right')
                    self.parent().start_connection(self, self.hover_port, side)
                    self.parent().setFocus() # Ensure canvas has focus
                    event.accept()
                    return

            # 1. Handle Selection
            ctrl_held = bool(event.modifiers() & Qt.ControlModifier)
            
            if hasattr(self.parent(), "handle_selection"):
                self.parent().handle_selection(self, ctrl_held)
            elif hasattr(self.parent(), "select_component"): # Fallback
                self.parent().select_component(self)
            else:
                self.is_selected = True
                self.update()
            
            # Ensure canvas gets focus for Deletion
            if self.parent():
                self.parent().setFocus()

            # 2. Prepare Dragging
            self.drag_start_global = event.globalPos()
            
            # 3. Accept event
            event.accept()
        else:
            super().mousePressEvent(event)

    def mouseMoveEvent(self, event):
        # 0. Check if we are drawing a connection (Parent has active_connection)
        # Since we accepted mousePress, we hold the grab. We must forward events or update parent.
        if hasattr(self.parent(), "active_connection") and self.parent().active_connection:
            # Map local pos to parent pos
            global_pos = self.mapToGlobal(event.pos())
            parent_pos = self.parent().mapFromGlobal(global_pos)
            
            # Use the new helper method on CanvasWidget to handle everything (snapping, path calc, repaint)
            if hasattr(self.parent(), "update_connection_drag"):
                self.parent().update_connection_drag(parent_pos)
            else:
                # Fallback if method missing (shouldn't happen)
                self.parent().active_connection.current_pos = parent_pos
                self.parent().active_connection.calculate_path()
                self.parent().update()
            return

        # Handle Port Hover Logic
        pos = event.pos()
        
        # Reset hover
        prev_hover = self.hover_port
        self.hover_port = None
        
        grips = self.config.get('grips')
        if not grips:
             # Match fallback logic from paintEvent
            grips = [
                {'x': 0, 'y': 50, 'side': 'left'},
                {'x': 100, 'y': 50, 'side': 'right'}
            ]
            
        content_rect = self.get_content_rect() # Use consistent rect
        
        for idx, grip in enumerate(grips):
            # Calculate pixel position
            cx = content_rect.x() + (grip['x'] / 100.0) * content_rect.width()
            cy = content_rect.y() + (grip['y'] / 100.0) * content_rect.height()
            center = QPoint(int(cx), int(cy))
            
            # Hit detection
            if (pos - center).manhattanLength() < 10:
                self.hover_port = idx
                break
            
        if prev_hover != self.hover_port:
            self.update()

        # Handle Dragging
        if event.buttons() & Qt.LeftButton and hasattr(self, 'drag_start_global') and self.drag_start_global:
            curr_global = event.globalPos()
            delta = curr_global - self.drag_start_global
            
            # Move ALL selected components
            parent = self.parent()
            if parent and hasattr(parent, "components"):
                for comp in parent.components:
                    if comp.is_selected:
                        comp.move(comp.pos() + delta)
                # FIX: Force parent update during drag to redraw connected lines
                parent.update()
            else:
                self.move(self.pos() + delta)
                if parent: parent.update()
                
            # Update start position for next incremental move
            self.drag_start_global = curr_global

    def mouseReleaseEvent(self, event):
        # Forward release to parent if creating connection
        if hasattr(self.parent(), "active_connection") and self.parent().active_connection:
            # Map event to parent coordinate space
            global_pos = self.mapToGlobal(event.pos())
            parent_pos = self.parent().mapFromGlobal(global_pos)
            
            # Construct a dummy event or call parent logic directly
            # For simplicity, let's just trigger the parent's logic manually or forward the event
            # Forwarding is cleaner if we adjust position
            
            # Note: We cannot easily 'forward' the event object with modified pos without creating new QMouseEvent
            # But CanvasWidget.mouseReleaseEvent logic is based on `active_connection` state.
            # We can just call a helper on parent or try to reconstruct the event.
            # Easiest: Call parent.handle_connection_release(parent_pos)
            if hasattr(self.parent(), "handle_connection_release"):
                self.parent().handle_connection_release(parent_pos)
            
        self.drag_start_global = None
        super().mouseReleaseEvent(event)

