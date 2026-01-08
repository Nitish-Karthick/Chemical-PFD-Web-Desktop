"""
Export utilities for canvas content.
"""
import json
import os
import pandas as pd
from PyQt5.QtCore import Qt, QRectF, QPoint, QSizeF, QSize
from PyQt5.QtGui import QPainter, QImage, QPageSize, QRegion, QColor
from PyQt5.QtWidgets import QWidget, QLabel
from PyQt5.QtPrintSupport import QPrinter
from src.canvas import painter as canvas_painter
from src.component_widget import ComponentWidget
from src.connection import Connection

# ---------------------- HELPERS ----------------------
def get_content_rect(canvas, padding=50):
    """Calculates the bounding rectangle of all canvas content."""
    content_rect = QRectF()
    for comp in canvas.components:
        content_rect = content_rect.united(QRectF(comp.geometry()))
        
    for conn in canvas.connections:
        if not conn.path: continue
        for p in conn.path:
            content_rect = content_rect.united(QRectF(p.x(), p.y(), 1, 1))

    if content_rect.isEmpty():
        return QRectF(canvas.rect())
        
    content_rect.adjust(-padding, -padding, padding, padding)
    return content_rect

def render_to_image(canvas, rect, scale=1.0):
    """Renders the specified canvas area to a QImage."""
    img_size = rect.size().toSize() * scale
    image = QImage(img_size, QImage.Format_ARGB32)
    image.fill(Qt.white)
    
    painter = QPainter(image)
    try:
        painter.setRenderHint(QPainter.Antialiasing)
        painter.setRenderHint(QPainter.SmoothPixmapTransform)
        painter.setRenderHint(QPainter.TextAntialiasing)
        painter.setRenderHint(QPainter.HighQualityAntialiasing)
        
        painter.scale(scale, scale)
        painter.translate(-rect.topLeft())
        
        # Draw Connections
        canvas_painter.draw_connections(painter, canvas.connections, canvas.components)
        
        # Draw Components (Manually to handle custom render logic if needed)
        for comp in canvas.components:
            painter.save()
            painter.translate(comp.pos())
            comp.render(painter, QPoint(), QRegion(), QWidget.DrawChildren)
            painter.restore()
    finally:
        painter.end()
    return image

def draw_equipment_table(painter, canvas, page_rect, start_y):
    """Draws the equipment table on the painter."""
    # Config
    row_height = 35
    w = page_rect.width()
    col_widths = [w * 0.15, w * 0.25, w * 0.60]
    headers = ["Sr. No.", "Tag Number", "Equipment Description"]
    
    # Headers
    y = start_y
    painter.setFont(QPainter().font()) # Reset
    f = painter.font()
    f.setPointSize(10); f.setBold(True); painter.setFont(f)
    
    current_x = 0
    for i, h in enumerate(headers):
        r = QRectF(current_x, y, col_widths[i], row_height)
        painter.setBrush(QColor("#e0e0e0")); painter.setPen(Qt.black)
        painter.drawRect(r); painter.drawText(r, Qt.AlignCenter, h)
        current_x += col_widths[i]
    y += row_height
    
    # Data Preparation
    equipment_list = []
    for comp in canvas.components:
        tag = comp.config.get("default_label", "")
        name = comp.config.get("name", "")
        if (not name or name == "Unknown Component") and getattr(comp, "svg_path", None):
            name = os.path.splitext(os.path.basename(comp.svg_path))[0]
            if name.startswith(("905", "907")): name = name[3:]
            name = name.replace("_", " ").strip()
        equipment_list.append((tag, name or "Unknown Component"))
    equipment_list.sort(key=lambda x: x[0])
    
    # Draw Rows
    f.setBold(False); painter.setFont(f)
    for idx, (tag, name) in enumerate(equipment_list):
        current_x = 0
        vals = [str(idx+1), tag, name]
        aligns = [Qt.AlignCenter, Qt.AlignCenter, Qt.AlignLeft | Qt.AlignVCenter]
        
        for i, val in enumerate(vals):
            r = QRectF(current_x, y, col_widths[i], row_height)
            painter.setBrush(Qt.NoBrush)
            painter.drawRect(r)
            rect_adj = r.adjusted(10,0,-10,0) if i==2 else r
            painter.drawText(rect_adj, aligns[i], val)
            current_x += col_widths[i]
        y += row_height

# ---------------------- EXPORT FUNCTIONS ----------------------
def export_to_image(canvas, filename):
    """Export canvas to high-quality image with proper rendering"""
    # Use higher resolution for better quality
    scale_factor = 3.0
    
    rect = get_content_rect(canvas)
    image = render_to_image(canvas, rect, scale=scale_factor)
    
    # Save with maximum quality
    image.save(filename, quality=100)

def export_to_pdf(canvas, filename):
    """Export canvas to high-quality PDF"""
    rect = get_content_rect(canvas)
    
    # Use high resolution for PDF
    scale_factor = 4.0
    image = render_to_image(canvas, rect, scale=scale_factor)
    
    # PDF Setup with HighResolution mode
    printer = QPrinter(QPrinter.HighResolution)
    printer.setOutputFormat(QPrinter.PdfFormat)
    printer.setOutputFileName(filename)
    
    # Calculate size in millimeters for proper scaling
    mm_per_inch = 25.4
    # Use printer's resolution for accurate conversion
    dpi = printer.resolution()
    
    s = rect.size()
    w_mm = (s.width() / dpi) * mm_per_inch
    h_mm = (s.height() / dpi) * mm_per_inch
    
    printer.setPageSize(QPageSize(QSizeF(w_mm, h_mm), QPageSize.Millimeter))
    printer.setPageMargins(0, 0, 0, 0, QPrinter.Millimeter)
    
    painter = QPainter(printer)
    try:
        # Enable high-quality rendering
        painter.setRenderHint(QPainter.Antialiasing)
        painter.setRenderHint(QPainter.SmoothPixmapTransform)
        painter.setRenderHint(QPainter.HighQualityAntialiasing)
        
        # Draw the high-res image to fill the page
        target_rect = painter.viewport()
        painter.drawImage(target_rect, image)
    finally:
        painter.end()

def generate_report_pdf(canvas, filename):
    """Generate multi-page PDF report with diagram and equipment list"""
    printer = QPrinter(QPrinter.ScreenResolution)
    printer.setOutputFormat(QPrinter.PdfFormat)
    printer.setOutputFileName(filename)
    printer.setPageSize(QPageSize(QPageSize.A4))
    printer.setPageMargins(10, 10, 10, 10, QPrinter.Millimeter)
    
    painter = QPainter(printer)
    try:
        # Page 1: Diagram
        rect = get_content_rect(canvas)
        # Use higher scale for crisp rendering
        image = render_to_image(canvas, rect, scale=4.0)
        
        page_rect = printer.pageRect(QPrinter.DevicePixel).toRect()
        
        # Title
        f = painter.font()
        f.setPointSize(16)
        f.setBold(True)
        painter.setFont(f)
        painter.drawText(page_rect, Qt.AlignTop | Qt.AlignHCenter, "Process Flow Diagram")
        
        # Image placement
        y_pos = int(0.8 * printer.logicalDpiY())
        avail_h = page_rect.height() - y_pos - 20
        
        # Scale with FastTransformation for high quality
        scaled = image.scaled(
            QSize(page_rect.width(), avail_h),
            Qt.KeepAspectRatio,
            Qt.FastTransformation
        )
            
        x_pos = (page_rect.width() - scaled.width()) // 2
        painter.drawImage(x_pos, y_pos, scaled)
        
        # Page 2: Table
        printer.newPage()
        f.setPointSize(14)
        painter.setFont(f)
        painter.drawText(page_rect, Qt.AlignTop | Qt.AlignHCenter, "List of Equipment")
        
        draw_equipment_table(painter, canvas, page_rect, 80)
        
    finally:
        painter.end()

def export_to_excel(canvas, filename):
    """Exports the list of equipment to an Excel file with auto-width columns."""
    equipment_list = []
    
    # Logic similar to draw_equipment_table to extract data
    for idx, comp in enumerate(canvas.components):
        tag = comp.config.get("default_label", "")
        name = comp.config.get("name", "")
        if (not name or name == "Unknown Component") and getattr(comp, "svg_path", None):
            name = os.path.splitext(os.path.basename(comp.svg_path))[0]
            if name.startswith(("905", "907")): name = name[3:]
            name = name.replace("_", " ").strip()
            
        equipment_list.append({
            "Sr. No.": idx + 1,
            "Tag Number": tag,
            "Equipment Description": name or "Unknown Component"
        })
        
    # Sort by Tag Number as in the table
    equipment_list.sort(key=lambda x: x["Tag Number"])
    
    # Re-assign Sr. No. after sort
    for i, item in enumerate(equipment_list):
        item["Sr. No."] = i + 1
        
    df = pd.DataFrame(equipment_list)
    
    # Ensure columns are in order
    df = df[["Sr. No.", "Tag Number", "Equipment Description"]]
    
    # Save to Excel with auto-width columns
    with pd.ExcelWriter(filename, engine='xlsxwriter') as writer:
        df.to_excel(writer, index=False, sheet_name='Equipment List')
        
        # Get workbook and worksheet objects
        workbook = writer.book
        worksheet = writer.sheets['Equipment List']
        
        # Auto-adjust column widths
        for idx, col in enumerate(df.columns):
            # Get the maximum length of data in each column
            max_len = max(
                df[col].astype(str).apply(len).max(),
                len(str(col))
            )
            # Add some padding
            worksheet.set_column(idx, idx, max_len + 2)

# ---------------------- PFD SERIALIZATION ----------------------
def save_to_pfd(canvas, filename):
    data = {
        "version": "1.0",
        "components": [
            {**c.to_dict(), "id": i} for i, c in enumerate(canvas.components)
        ],
        "connections": []
    }
    comp_map = {c: i for i, c in enumerate(canvas.components)}
    data["connections"] = [c.to_dict(comp_map) for c in canvas.connections]
        
    with open(filename, 'w') as f:
        json.dump(data, f, indent=4)

def load_from_pfd(canvas, filename):
    if not os.path.exists(filename): return False
    try:
        with open(filename, 'r') as f: data = json.load(f)
        
        canvas.components = []
        canvas.connections = []
        # Clear UI
        for c in canvas.children():
            if isinstance(c, (ComponentWidget, QLabel)): c.deleteLater()
            
        # Load Components
        id_map = {}
        for d in data.get("components", []):
            if not d.get("svg_path"): continue
            comp = ComponentWidget(d["svg_path"], canvas, config=d.get("config", {}))
            comp.move(d.get("x",0), d.get("y",0))
            comp.resize(d.get("width",100), d.get("height",100))
            comp.rotation_angle = d.get("rotation", 0)
            comp.update(); comp.show()
            canvas.components.append(comp)
            id_map[d.get("id")] = comp
            
        # Load Connections
        for d in data.get("connections", []):
            s, e = id_map.get(d.get("start_id")), id_map.get(d.get("end_id"))
            if s:
                c = Connection(s, d.get("start_grip"), d.get("start_side"))
                if e: c.set_end_grip(e, d.get("end_grip"), d.get("end_side"))
                c.path_offset = d.get("path_offset", 0.0)
                c.start_adjust = d.get("start_adjust", 0.0)
                c.end_adjust = d.get("end_adjust", 0.0)
                c.update_path(canvas.components, canvas.connections)
                canvas.connections.append(c)
                
        canvas.update()
        return True
    except Exception as e:
        print(f"Error loading PFD: {e}")
        return False