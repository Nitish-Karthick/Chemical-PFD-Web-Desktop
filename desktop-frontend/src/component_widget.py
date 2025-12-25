import os
from PyQt5.QtWidgets import QWidget
from PyQt5.QtSvg import QSvgRenderer
from PyQt5.QtCore import Qt, QRectF, QPoint
from PyQt5.QtGui import QPainter, QColor, QPen

class ComponentWidget(QWidget):
    def __init__(self, svg_path, parent=None, config=None):
        super().__init__(parent)
        self.svg_path = svg_path
        self.config = config or {}
        self.renderer = QSvgRenderer(svg_path)

        # Standard component size
        self.setFixedSize(100, 80)

        self.hover_port = None
        self.is_selected = False
        self.drag_start_global = None

        self.setAttribute(Qt.WA_Hover, True)
        self.setMouseTracking(True)

    def get_content_rect(self):
        bottom_pad = 25 if self.config.get('default_label') else 10
        w = max(1, self.width() - 20)
        h = max(1, self.height() - 10 - bottom_pad)
        return QRectF(10, 10, w, h)

    def paintEvent(self, event):
        painter = QPainter(self)
        painter.setRenderHint(QPainter.Antialiasing)

        # Selection Border
        if self.is_selected:
            painter.setPen(QPen(QColor("#60a5fa"), 2))
            painter.setBrush(Qt.NoBrush)
            painter.drawRoundedRect(self.rect().adjusted(1, 1, -1, -1), 8, 8)

        content_rect = self.get_content_rect()

        # Render SVG
        view_box = self.renderer.viewBoxF()
        if not view_box.isEmpty():
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
            
            self.renderer.render(painter, target_rect)
        else:
            self.renderer.render(painter, content_rect)

        # Label
        if self.config.get('default_label'):
            painter.setPen(QPen(Qt.black))
            text_rect = QRectF(0, content_rect.bottom() + 2, self.width(), 20)
            painter.drawText(text_rect, Qt.AlignCenter, self.config['default_label'])

        # Draw Ports
        grips = self.config.get('grips')
        if not grips:
            grips = [
                {"x": 0, "y": 50, "side": "left"},
                {"x": 100, "y": 50, "side": "right"},
            ]

        for idx, grip in enumerate(grips):
            self.draw_dynamic_port(painter, grip, idx, content_rect)

    def draw_dynamic_port(self, painter, grip, idx, content_rect):
        cx = content_rect.x() + (grip["x"] / 100.0) * content_rect.width()
        cy = content_rect.y() + (grip["y"] / 100.0) * content_rect.height()
        center = QPoint(int(cx), int(cy))

        radius = 6 if self.hover_port == idx else 4
        color = QColor("#22c55e") if self.hover_port == idx else QColor("cyan")

        painter.setBrush(color)
        painter.setPen(Qt.NoPen)
        painter.drawEllipse(center, radius, radius)

    def get_grip_position(self, idx):
        grips = self.config.get('grips') or [
            {"x": 0, "y": 50, "side": "left"},
            {"x": 100, "y": 50, "side": "right"},
        ]

        if 0 <= idx < len(grips):
            grip = grips[idx]
            content_rect = self.get_content_rect()
            cx = content_rect.x() + (grip["x"] / 100.0) * content_rect.width()
            cy = content_rect.y() + (grip["y"] / 100.0) * content_rect.height()
            return QPoint(int(cx), int(cy))

        return QPoint(0, 0)

    # SELECTION
    def set_selected(self, selected: bool):
        self.is_selected = selected
        self.update()

    # MOUSE PRESS
    def mousePressEvent(self, event):
        if event.button() == Qt.LeftButton:

            # FIRST: CHECK IF CLICKED A PORT — START A CONNECTION
            if self.hover_port is not None:
                if hasattr(self.parent(), "start_connection"):
                    grips = self.config.get('grips')
                    if not grips:
                        grips = [
                            {"x": 0, "y": 50, "side": "left"},
                            {"x": 100, "y": 50, "side": "right"},
                        ]

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
                self.parent().update_connection_drag(parent_pos)
            return

        # PORT HOVER DETECTION
        pos = event.pos()
        prev = self.hover_port
        self.hover_port = None

        grips = self.config.get('grips')
        if not grips:
            grips = [
                {"x": 0, "y": 50, "side": "left"},
                {"x": 100, "y": 50, "side": "right"},
            ]

        content_rect = self.get_content_rect()

        for idx, grip in enumerate(grips):
            cx = content_rect.x() + (grip["x"] / 100.0) * content_rect.width()
            cy = content_rect.y() + (grip["y"] / 100.0) * content_rect.height()
            center = QPoint(int(cx), int(cy))

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
                        # Calculate new pos
                        new_pos = comp.pos() + delta
                        
                        # Boundary checks
                        pw = parent.width()
                        ph = parent.height()
                        cw = comp.width()
                        ch = comp.height()
                        
                        # Clamp X and Y
                        nx = max(0, min(new_pos.x(), pw - cw))
                        ny = max(0, min(new_pos.y(), ph - ch))
                        
                        # Apply new position
                        comp.move(nx, ny)
                        
                parent.update()
            else:
                new_pos = self.pos() + delta
                
                # Boundary Check for single item (if unrelated parent)
                if parent:
                    pw = parent.width()
                    ph = parent.height()
                    nx = max(0, min(new_pos.x(), pw - self.width()))
                    ny = max(0, min(new_pos.y(), ph - self.height()))
                    self.move(nx, ny)
                    parent.update()
                else:
                    self.move(new_pos)

            self.drag_start_global = curr_global

    # MOUSE RELEASE
    def mouseReleaseEvent(self, event):
        # Forward release during connection building
        if hasattr(self.parent(), "active_connection") and self.parent().active_connection:
            g = self.mapToGlobal(event.pos())
            parent_pos = self.parent().mapFromGlobal(g)
            if hasattr(self.parent(), "handle_connection_release"):
                self.parent().handle_connection_release(parent_pos)

        self.drag_start_global = None
        super().mouseReleaseEvent(event)
