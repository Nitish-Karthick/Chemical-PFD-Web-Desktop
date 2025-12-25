from PyQt5.QtGui import QColor, QPen, QBrush
from PyQt5.QtCore import Qt

def draw_grid(painter, width, height, theme="light"):
    dot_color = QColor(90, 90, 90) if theme == "dark" else QColor(180, 180, 180)
    painter.setPen(dot_color)

    grid_spacing = 30
    for x in range(0, width, grid_spacing):
        for y in range(0, height, grid_spacing):
            painter.drawPoint(x, y)

def draw_connections(painter, connections, components):
    # Draw all finished connections
    # Draw all finished connections
    for conn in connections:
        # Update path with Jump Logic
        # conn.update_path takes (components, other_connections)
        conn.update_path(components, connections)

        # Render Connection (Line + Arrow + Jumps)
        conn.paint(painter)

        # Draw Edit Handles if selected
        if conn.is_selected:
            painter.setBrush(QColor("#2563eb"))
            painter.setPen(Qt.NoPen)
            for pt in conn.path:
                painter.drawEllipse(pt, 4, 4)

def draw_active_connection(painter, active_connection):
    if active_connection:
        painter.setPen(QPen(Qt.black, 2, Qt.DashLine))
        painter.setBrush(Qt.NoBrush)
        
        if not active_connection.painter_path.isEmpty():
            painter.drawPath(active_connection.painter_path)
        else:
            path = active_connection.path
            for i in range(len(path) - 1):
                painter.drawLine(path[i], path[i + 1])
