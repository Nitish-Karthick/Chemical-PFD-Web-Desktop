"""
Export utilities for canvas content.
"""
import json
import os
from PyQt5.QtCore import Qt, QRectF, QPoint, QSizeF, QSize
from PyQt5.QtGui import QPainter, QImage, QPageSize, QRegion, QColor
from PyQt5.QtWidgets import QWidget, QLabel
from PyQt5.QtPrintSupport import QPrinter
from src.canvas import painter as canvas_painter
from src.component_widget import ComponentWidget
from src.connection import Connection

def export_to_image(canvas, filename):
    """Export canvas to image file (PNG/JPG)."""
    image = QImage(canvas.size(), QImage.Format_ARGB32)
    image.fill(Qt.transparent)
    
    painter = QPainter(image)
    canvas.render(painter)
    painter.end()
    image.save(filename)


def export_to_pdf(canvas, filename):
    """Export canvas content to PDF matching JPG output exactly."""
    # Calculate bounding rect of all components
    content_rect = QRectF()
    
    for comp in canvas.components:
         content_rect = content_rect.united(QRectF(comp.geometry()))
         
    # Use full canvas if empty
    if content_rect.isEmpty():
        content_rect = QRectF(canvas.rect())
    else:
        # Add padding
        content_rect.adjust(-50, -50, 50, 50)
        # Clamp to canvas bounds
        canvas_rect = QRectF(canvas.rect())
        content_rect = content_rect.intersected(canvas_rect)
        
    # Create image of content area (same as JPG)
    content_size = content_rect.size().toSize()
    image = QImage(content_size, QImage.Format_ARGB32)
    image.fill(Qt.white)
    
    # Render content to image
    painter_img = QPainter(image)
    painter_img.translate(-content_rect.topLeft())
    canvas.render(painter_img)
    painter_img.end()
    
    # Calculate page size in millimeters (standard PDF units)
    # Assume 96 DPI (standard screen resolution)
    dpi = 96.0
    mm_per_inch = 25.4
    width_mm = (content_size.width() / dpi) * mm_per_inch
    height_mm = (content_size.height() / dpi) * mm_per_inch
    
    # Create PDF with exact page size
    printer = QPrinter(QPrinter.ScreenResolution)
    printer.setOutputFormat(QPrinter.PdfFormat)
    printer.setOutputFileName(filename)
    printer.setPageSize(QPageSize(QSizeF(width_mm, height_mm), QPageSize.Millimeter))
    printer.setPageMargins(0, 0, 0, 0, QPrinter.Millimeter)
    
    # Draw image to PDF
    painter_pdf = QPainter(printer)
    painter_pdf.drawImage(0, 0, image)
    painter_pdf.end()


def generate_report_pdf(canvas, filename):
    """
    Generates a multi-page PDF report:
    Page 1: The Process Flow Diagram
    Page 2: List of Equipment (Auto-generated from components)
    """
    printer = QPrinter(QPrinter.ScreenResolution)
    printer.setOutputFormat(QPrinter.PdfFormat)
    printer.setOutputFileName(filename)
    printer.setPageSize(QPageSize(QPageSize.A4))
    printer.setPageMargins(10, 10, 10, 10, QPrinter.Millimeter) 
    
    painter = QPainter(printer)
    
    try:
        # ---------------- PAGE 1: DIAGRAM ----------------
        
        # 1. Calculate Bounding Box of ALL content (off-screen included)
        content_rect = QRectF()
        
        # Components
        for comp in canvas.components:
             # geometry() is relative to canvas (QWidget)
             content_rect = content_rect.united(QRectF(comp.geometry()))
        
        # Connections
        for conn in canvas.connections:
            if not conn.path: continue
            for p in conn.path:
                content_rect = content_rect.united(QRectF(p.x(), p.y(), 1, 1))

        if content_rect.isEmpty():
            content_rect = QRectF(canvas.rect())
        else:
            # Add padding
            content_rect.adjust(-50, -50, 50, 50)
        
        # 2. Render to High-Res Image
        # We manually render components to avoiding widget-clipping from canvas.render()
        scale_factor = 2.0 
        img_size = content_rect.size().toSize() * scale_factor
        
        # Create image
        image = QImage(img_size, QImage.Format_ARGB32)
        image.fill(Qt.white)
        
        img_painter = QPainter(image)
        try:
            img_painter.scale(scale_factor, scale_factor)
            
            # Translate origin so content starts at (0,0) of the image
            # content_rect.topLeft() in Canvas space becomes (0,0) in Image space
            img_painter.translate(-content_rect.topLeft())
            
            # A. Draw Connections (using painter module)
            canvas_painter.draw_connections(img_painter, canvas.connections, canvas.components)
            
            # B. Draw Components Manually
            # We iterate through standard widgets and use their render() method onto our painter
            # We must translate the painter to the component's position
            for comp in canvas.components:
                img_painter.save()
                img_painter.translate(comp.pos())
                comp.render(img_painter, QPoint(), QRegion(), QWidget.DrawChildren)
                img_painter.restore()
                
        finally:
            img_painter.end()
        
        # 3. Draw Image to Printer (Fit to Page)
        page_rect = printer.pageRect(QPrinter.DevicePixel).toRect()
        
        # Aspect Ratio Fit
        scaled_image = image.scaled(page_rect.size(), Qt.KeepAspectRatio, Qt.SmoothTransformation)
        
        # Center
        x_off = (page_rect.width() - scaled_image.width()) / 2
        
        # Title
        painter.setPen(Qt.black)
        font = painter.font()
        font.setPointSize(16)
        font.setBold(True)
        painter.setFont(font)
        painter.drawText(page_rect, Qt.AlignTop | Qt.AlignHCenter, "Process Flow Diagram")
        
        # Helper for Y position
        # Use DPI to determine safe vertical spacing relative to resolution
        dpi_y = printer.logicalDpiY()
        # Gap of 0.8 inches for the title area
        current_y = int(0.8 * dpi_y) 
        
        # Draw Image
        # Center vertically in remaining space? Or just top-align
        # Let's put it below title
        target_rect = QRectF(x_off, current_y, scaled_image.width(), scaled_image.height())
        
        # Check if fits
        if target_rect.bottom() > page_rect.bottom():
             # Rescale to fit remaining height
             available_h = page_rect.height() - current_y - 20
             scaled_image = image.scaled(QSize(page_rect.width(), int(available_h)), 
                                        Qt.KeepAspectRatio, Qt.SmoothTransformation)
             x_off = (page_rect.width() - scaled_image.width()) / 2
             target_rect = QRectF(x_off, current_y, scaled_image.width(), scaled_image.height())
             
        painter.drawImage(target_rect, image)
        
        
        # ---------------- PAGE 2: EQUIPMENT TABLE ----------------
        printer.newPage()
        
        # Title
        font.setPointSize(14)
        font.setBold(True)
        painter.setFont(font)
        painter.drawText(page_rect, Qt.AlignTop | Qt.AlignHCenter, "List of Equipment")
        
        # Table Config
        y_start = 80
        row_height = 35
        # Page Width approx 4800 (High Res Printer) or screen
        # We need relative widths. 
        # DevicePixel rect width might be varied. 
        w = page_rect.width()
        
        col_ratios = [0.15, 0.25, 0.60] # Sr No, Tag, Description
        col_widths = [w * r for r in col_ratios]
        headers = ["Sr. No.", "Tag Number", "Equipment Description"]
        
        # Draw Headers
        font.setPointSize(10)
        font.setBold(True)
        painter.setFont(font)
        
        # Margins (Left/Right 50px)
        margin_x = 0 # pageRect already has margin? No, printer.pageRect() is printable area
        # but let's add a visual margin
        table_x = 0
        y = y_start
        
        # Draw Header Row
        current_x = table_x
        for i, h in enumerate(headers):
            r = QRectF(current_x, y, col_widths[i], row_height)
            painter.setBrush(QColor("#e0e0e0"))
            painter.setPen(Qt.black)
            painter.drawRect(r)
            painter.drawText(r, Qt.AlignCenter, h)
            current_x += col_widths[i]
            
        y += row_height
        
        # Prepare Data
        # Filter components to list (exclude plain labels or connectors if any?)
        # Base logic: All ComponentWidgets
        equipment_list = []
        for comp in canvas.components:
             tag = comp.config.get("default_label", "")
             name = comp.config.get("name", "")
             
             # Fallback if name is missing or unknown
             if (not name or name == "Unknown Component") and hasattr(comp, "svg_path") and comp.svg_path:
                 base = os.path.basename(comp.svg_path)
                 # Remove extension and clean up
                 name = os.path.splitext(base)[0]
                 # Basic cleanup (e.g. 905Exchanger -> Exchanger)
                 if name.startswith("905"): name = name[3:]
                 if name.startswith("907"): name = name[3:]
                 name = name.replace("_", " ").strip()
             
             if not name:
                 name = "Unknown Component"
             
             equipment_list.append((tag, name))
             
        # Sort by Tag
        equipment_list.sort(key=lambda x: x[0])
        
        # Draw Rows
        font.setBold(False)
        painter.setFont(font)
        
        for idx, (tag, name) in enumerate(equipment_list):
            current_x = table_x
            
            # 1. Sr No
            r = QRectF(current_x, y, col_widths[0], row_height)
            painter.setBrush(Qt.NoBrush)
            painter.drawRect(r)
            painter.drawText(r, Qt.AlignCenter, str(idx + 1))
            current_x += col_widths[0]
            
            # 2. Tag
            r = QRectF(current_x, y, col_widths[1], row_height)
            painter.drawRect(r)
            painter.drawText(r, Qt.AlignCenter, tag)
            current_x += col_widths[1]
            
            # 3. Name
            r = QRectF(current_x, y, col_widths[2], row_height)
            painter.drawRect(r)
            # Add padding for description
            text_r = r.adjusted(10, 0, -10, 0)
            painter.drawText(text_r, Qt.AlignLeft | Qt.AlignVCenter, name)
            current_x += col_widths[2]
            
            y += row_height
            
            # Pagination
            if y > page_rect.bottom() - 50:
                printer.newPage()
                y = 50 
                # Re-draw headers? Maybe just continue list
                
    finally:
        painter.end()


# ---------------------- PFD SERIALIZATION ----------------------
def save_to_pfd(canvas, filename):
    """Saves the canvas state to a JSON .pfd file."""
    data = {
        "version": "1.0",
        "components": [],
        "connections": []
    }
    
    # Map components to temporary IDs
    comp_to_id = {comp: i for i, comp in enumerate(canvas.components)}
    
    for comp in canvas.components:
        comp_data = comp.to_dict()
        comp_data["id"] = comp_to_id[comp]
        data["components"].append(comp_data)
        
    for conn in canvas.connections:
        conn_data = conn.to_dict(comp_to_id)
        data["connections"].append(conn_data)
        
    with open(filename, 'w') as f:
        json.dump(data, f, indent=4)

def load_from_pfd(canvas, filename):
    """Loads a .pfd file into the canvas."""
    if not os.path.exists(filename):
        return False
        
    try:
        with open(filename, 'r') as f:
            data = json.load(f)
            
        # Basic validation
        if not isinstance(data, dict) or "components" not in data:
            raise ValueError("Invalid PFD file format")
            
        # Clear existing
        canvas.components = []
        canvas.connections = []
        # Clear widgets
        for child in canvas.children():
            if isinstance(child, (ComponentWidget, QLabel)):
                child.deleteLater()
                
        # Load Components
        id_to_comp = {}
        for comp_data in data.get("components", []):
            # Reconstruct Component
            svg_path = comp_data.get("svg_path")
            config = comp_data.get("config", {})
            
            # Fallbacks for legacy/missing data
            if not svg_path: continue
            
            comp = ComponentWidget(svg_path, canvas, config=config)
            comp.move(comp_data.get("x", 0), comp_data.get("y", 0))
            comp.resize(comp_data.get("width", 100), comp_data.get("height", 100))
            if "rotation" in comp_data:
                comp.rotation_angle = comp_data["rotation"]
            comp.update() # Apply rotation
            comp.show()
            
            canvas.components.append(comp)
            id_to_comp[comp_data.get("id")] = comp
            
        # Load Connections
        for conn_data in data.get("connections", []):
            start_id = conn_data.get("start_id")
            end_id = conn_data.get("end_id")
            
            start_comp = id_to_comp.get(start_id)
            end_comp = id_to_comp.get(end_id)
            
            if start_comp:
                conn = Connection(start_comp, conn_data.get("start_grip"), conn_data.get("start_side"))
                if end_comp:
                    conn.set_end_grip(end_comp, conn_data.get("end_grip"), conn_data.get("end_side"))
                
                # Restore adjustments
                conn.path_offset = conn_data.get("path_offset", 0.0)
                conn.start_adjust = conn_data.get("start_adjust", 0.0)
                conn.end_adjust = conn_data.get("end_adjust", 0.0)
                
                conn.update_path(canvas.components, canvas.connections)
                canvas.connections.append(conn)
                
        canvas.update()
        return True
        
    except Exception as e:
        print(f"Error loading PFD: {e}")
        return False

