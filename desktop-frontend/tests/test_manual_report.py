
import os
import sys

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src.canvas.export import generate_report_pdf

class MockComponent:
    def __init__(self, label, name, obj_type=None, svg_path=None):
        self.config = {
            "default_label": label,
            "name": name,
            "object": obj_type
        }
        self.svg_path = svg_path

class MockCanvas:
    def __init__(self):
        self.components = []
        self.zoom_level = 1.0

def test_report_generation():
    canvas = MockCanvas()
    
    # Add Test Data with LaTeX strings
    canvas.components.append(MockComponent("$C01A$", "Distillation Column", "Column"))
    canvas.components.append(MockComponent("$P-101$", "Centrifugal Pump", "Pump"))
    canvas.components.append(MockComponent("V-202", "Storage Tank", "Vessel"))
    canvas.components.append(MockComponent("$HX-500$", "Heat Exchanger", "Exchanger"))
    canvas.components.append(MockComponent("Unknown-01", "", "Unknown")) # Should become "no description"
    canvas.components.append(MockComponent("Unknown-02", "Unknown Component", "Unknown")) # Should become "no description"
    
    output_file = "d:/Intern/work/Chemical-PFD-Web-Desktop/test_report.pdf"
    
    print(f"Generating report to {output_file}...")
    try:
        generate_report_pdf(canvas, output_file)
        
        if os.path.exists(output_file) and os.path.getsize(output_file) > 0:
            print("SUCCESS: Report generated successfully.")
            import os
            # print(f"File size: {os.path.getsize(output_file)} bytes")
        else:
            print("FAILURE: Report file not found or empty.")
            
    except Exception as e:
        print(f"FAILURE: Exception occurred: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_report_generation()
