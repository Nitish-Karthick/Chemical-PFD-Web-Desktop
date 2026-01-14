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
from src.canvas import resources
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
        painter.save()
        # Scale connections to match the visual coordinate system of components
        if hasattr(canvas, 'zoom_level'):
            # When exporting efficiently (Zoom 1.0), this is just 1.0
            # If we didn't reset zoom, we'd need to match visual scale
            z = canvas.zoom_level
            painter.scale(z, z)
        canvas_painter.draw_connections(painter, canvas.connections, canvas.components)
        painter.restore()
        
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
    # STRATEGY: 
    # 1. Save current zoom
    # 2. Reset zoom to 1.0 (This forces all components to render at logic size = visual size)
    # 3. Export with Scale 3.0 (High Res)
    # 4. Restore zoom
    
    old_z = getattr(canvas, 'zoom_level', 1.0)
    
    # 1. & 2. Reset Zoom
    if old_z != 1.0:
        canvas.zoom_level = 1.0
        canvas.apply_zoom()
        
    try:
        # 3. Export
        scale_factor = 3.0
        rect = get_content_rect(canvas)
        image = render_to_image(canvas, rect, scale=scale_factor)
        image.save(filename, quality=100)
    finally:
        # 4. Restore Zoom
        if old_z != 1.0:
            canvas.zoom_level = old_z
            canvas.apply_zoom()

def export_to_pdf(canvas, filename):
    """Export canvas to high-quality PDF"""
    
    # STRATEGY: Reset Zoom to 1.0
    old_z = getattr(canvas, 'zoom_level', 1.0)
    if old_z != 1.0:
        canvas.zoom_level = 1.0
        canvas.apply_zoom()
        
    try:
        rect = get_content_rect(canvas)
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
    finally:
        # Restore Zoom
        if old_z != 1.0:
            canvas.zoom_level = old_z
            canvas.apply_zoom()

def generate_report_pdf(canvas, filename):
    """Generate professional PDF report using ReportLab"""
    try:
        from src.reports.generator import PDFReportGenerator
    except ImportError:
        print("ReportLab not found. Please install it: pip install reportlab")
        return

    # Extract Data
    data = []
    
    # Sort components by tag for cleaner report
    sorted_components = sorted(canvas.components, key=lambda c: c.config.get("default_label", ""))
    
    for comp in sorted_components:
        # Extract basic fields
        tag = comp.config.get("default_label", "")
        name = comp.config.get("name", "")
        obj_type = comp.config.get("object", "")
        
            
        # FORCE "no description" for all components per user request
        name = "no description"
            
        # Fallback for Type if empty (use name or generic)
        if not obj_type:
            obj_type = name if name else "Equipment"
            
        data.append({
            'tag': tag,
            'type': obj_type,
            'description': name
        })
        
    # Generate
    generator = PDFReportGenerator(filename)
    generator.generate(data)
    print(f"Report generated at {filename}")

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
    """
    Saves the project in a format compatible with the Web Frontend.
    Structure matches DiagramExportData from web-frontend types.ts.
    """
    import datetime
    
    # 1. Map Items (Components)
    items = []
    comp_map = {c: i for i, c in enumerate(canvas.components)}
    
    for i, c in enumerate(canvas.components):
        # Base dict from component
        c_dict = c.to_dict()
        
        # Map to Web 'CanvasItem' structure
        item = {
            "id": i,
            "x": c_dict["x"],
            "y": c_dict["y"],
            "width": c_dict["width"],
            "height": c_dict["height"],
            "rotation": c_dict["rotation"],
            "svg": c_dict["svg_path"], # Web expects 'svg' (string content or path)
            # Web uses 'object' as key sometimes, or name
            "name": c_dict["config"].get("name", ""),
            "object": c_dict["config"].get("object", ""),
            "s_no": c_dict["config"].get("s_no", ""),
            "legend": c_dict["config"].get("legend", ""),
            "suffix": c_dict["config"].get("suffix", ""),
            "label": c_dict["config"].get("default_label", ""),
            "config": c_dict["config"], # Keep full config for Desktop fidelity
            "grips": c.get_grips()
        }
        items.append(item)

    # 2. Map Connections
    connections = []
    for i, c in enumerate(canvas.connections):
        start_id = comp_map.get(c.start_component, -1)
        end_id = comp_map.get(c.end_component, -1)
        
        conn = {
            "id": i,
            "sourceItemId": start_id,
            "sourceGripIndex": c.start_grip_index,
            # Web uses 'sourceGripIndex', Desktop uses 'start_grip' internally via to_dict,
            # but here we serialize to Web format.
            "targetItemId": end_id,
            "targetGripIndex": c.end_grip_index,
            
            # Additional Desktop Properties (Preserved for full fidelity)
            "start_side": c.start_side,
            "end_side": c.end_side,
            "path_offset": c.path_offset,
            "start_adjust": c.start_adjust,
            "end_adjust": c.end_adjust,
        }
        connections.append(conn)

    # 3. Construct Final JSON
    data = {
        "version": "1.0.0",
        "displayedAt": datetime.datetime.now().isoformat(),
        "editorVersion": "1.0.0",
        "canvasState": {
            "items": items,
            "connections": connections,
            "sequenceCounter": len(items)
        },
        "viewport": {
            "scale": getattr(canvas, "zoom_level", 1.0),
            "position": {"x": 0, "y": 0} # Desktop doesn't track pan in same way yet
        },
        "project": {
            "id": "desktop-export",
            "name": os.path.basename(filename).replace(".pfd", ""),
            "createdAt": datetime.datetime.now().isoformat()
        }
    }
        
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
            
        # DETECT FORMAT
        # 1. New Web/Desktop Format (has 'canvasState')
        if "canvasState" in data:
            items_data = data["canvasState"].get("items", [])
            conns_data = data["canvasState"].get("connections", [])
            viewport = data.get("viewport", {})
            # Optional: Restore zoom?
            # if "scale" in viewport: canvas.zoom_level = viewport["scale"]
            
        # 2. Legacy Desktop Format (root 'components')
        elif "components" in data:
            items_data = data.get("components", [])
            conns_data = data.get("connections", [])
        else:
            print("Unknown file format")
            return False

        # Load Components
        id_map = {} # Maps serialized ID -> ComponentWidget
        
        for d in items_data:
            # Handle key differences between formats
            # Desktop: svg_path, Web: svg
            svg_path = d.get("svg_path") or d.get("svg")
            if not svg_path: continue
            
            # Resolve Path
            if not os.path.exists(svg_path):
                # Try finding it in assets using name/object or basename
                name = d.get("name") or d.get("object") or os.path.basename(svg_path)
                found = resources.find_svg_path(name, canvas.base_dir)
                if found:
                    svg_path = found
                else:
                    print(f"Warning: SVG not found for {name} ({svg_path})")
                    continue # Skip invisible component? Or create placeholder?
            
            # Desktop: config dict, Web: flat fields (mostly)
            # We rebuild config
            config = d.get("config", {})
            if not config:
                # Rebuild config from flat fields if missing (Web import)
                config = {
                    "name": d.get("name", ""),
                    "object": d.get("object", ""),
                    "s_no": d.get("s_no", ""),
                    "legend": d.get("legend", ""),
                    "suffix": d.get("suffix", ""),
                    "default_label": d.get("label", "")
                }
            
            comp = ComponentWidget(svg_path, canvas, config=config)
            
            # CRITICAL FIX: Update LOGICAL rect, not just visual
            x = d.get("x", 0)
            y = d.get("y", 0)
            w = d.get("width", 100)
            h = d.get("height", 100)
            
            comp.logical_rect = QRectF(x, y, w, h)
            comp.rotation_angle = d.get("rotation", 0)
            
            # Apply Visuals immediately
            comp.update_visuals(canvas.zoom_level)
            
            comp.show()
            canvas.components.append(comp)
            
            # Store ID for connection mapping
            # Web uses 'id', Desktop uses 'id' in new serialization
            comp_id = d.get("id")
            if comp_id is not None:
                id_map[comp_id] = comp
            
        # Load Connections
        for d in conns_data:
            # Web keys: sourceItemId/targetItemId
            # Legacy keys: start_id/end_id
            
            sid = d.get("sourceItemId") if "sourceItemId" in d else d.get("start_id")
            eid = d.get("targetItemId") if "targetItemId" in d else d.get("end_id")
            
            s = id_map.get(sid)
            e = id_map.get(eid)
            
            if s:
                # Web: sourceGripIndex, Legacy: start_grip
                sg = d.get("sourceGripIndex") if "sourceGripIndex" in d else d.get("start_grip")
                eg = d.get("targetGripIndex") if "targetGripIndex" in d else d.get("end_grip")
                
                # Sides
                ss = d.get("start_side", "right")
                es = d.get("end_side", "left")

                c = Connection(s, sg, ss)
                if e: c.set_end_grip(e, eg, es)
                
                c.path_offset = d.get("path_offset", 0.0)
                c.start_adjust = d.get("start_adjust", 0.0)
                c.end_adjust = d.get("end_adjust", 0.0)
                
                c.update_path(canvas.components, canvas.connections)
                canvas.connections.append(c)
                
        canvas.update()
        return True
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"Error loading PFD: {e}")
        return False