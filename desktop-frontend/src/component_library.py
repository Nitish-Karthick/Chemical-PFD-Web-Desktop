import os
import csv
from PyQt5.QtCore import Qt, QMimeData, QSize
from PyQt5.QtGui import QIcon, QDrag
from PyQt5.QtWidgets import (
    QDockWidget, QWidget, QVBoxLayout, QLineEdit, 
    QScrollArea, QLabel, QToolButton, QGridLayout
)


class ComponentButton(QToolButton):
    def __init__(self, component_data, icon_path, parent=None):
        super().__init__(parent)
        self.component_data = component_data
        
        if os.path.exists(icon_path):
            self.setIcon(QIcon(icon_path))
            self.setIconSize(QSize(48, 48))
        
        self.setToolTip(component_data['name'])
        self.setFixedSize(60, 60)
        self.setStyleSheet("""
            QToolButton {
                border: 1px solid #ccc;
                border-radius: 4px;
                background-color: white;
                padding: 2px;
            }
            QToolButton:hover {
                border: 2px solid #0078d7;
                background-color: #e5f3ff;
            }
        """)
        
        self.dragStartPosition = None
    
    def mousePressEvent(self, event):
        super().mousePressEvent(event)
        if event.button() == Qt.LeftButton:
            self.dragStartPosition = event.pos()
    
    def mouseMoveEvent(self, event):
        if not (event.buttons() & Qt.LeftButton):
            return
        if not self.dragStartPosition:
            return
        if (event.pos() - self.dragStartPosition).manhattanLength() < 10:
            return
        
        drag = QDrag(self)
        mimeData = QMimeData()
        mimeData.setText(self.component_data['object'])
        drag.setMimeData(mimeData)
        
        if not self.icon().isNull():
            drag.setPixmap(self.icon().pixmap(32, 32))
        
        drag.exec_(Qt.CopyAction)


class ComponentLibrary(QDockWidget):
    def __init__(self, parent=None):
        super(ComponentLibrary, self).__init__("Component Library", parent)
        
        self.setFeatures(QDockWidget.DockWidgetFloatable | QDockWidget.DockWidgetMovable)
        self.setAllowedAreas(Qt.LeftDockWidgetArea | Qt.RightDockWidgetArea)
        
        self.component_data = []
        self.icon_buttons = []
        
        self._setup_ui()
        self._load_components()
        self._populate_icons()
        
        self.setFixedWidth(400)
    
    def _setup_ui(self):
        main_widget = QWidget()
        main_layout = QVBoxLayout(main_widget)
        main_layout.setContentsMargins(5, 5, 5, 5)
        main_layout.setSpacing(5)
        
        self.search_box = QLineEdit()
        self.search_box.setPlaceholderText("Search components...")
        self.search_box.textChanged.connect(self._filter_icons)
        main_layout.addWidget(self.search_box)
        
        self.scroll_area = QScrollArea()
        self.scroll_area.setWidgetResizable(True)
        self.scroll_area.setHorizontalScrollBarPolicy(Qt.ScrollBarAlwaysOff)
        
        self.scroll_widget = QWidget()
        self.scroll_layout = QVBoxLayout(self.scroll_widget)
        self.scroll_layout.setAlignment(Qt.AlignTop | Qt.AlignLeft)
        self.scroll_layout.setSpacing(10)
        
        self.scroll_area.setWidget(self.scroll_widget)
        main_layout.addWidget(self.scroll_area)
        
        self.setWidget(main_widget)
    
    def _load_components(self):
        csv_path = os.path.join("ui", "assets", "Component_Details.csv")
        
        if not os.path.exists(csv_path):
            return
        
        try:
            with open(csv_path, 'r', encoding='utf-8') as file:
                reader = csv.DictReader(file)
                for row in reader:
                    if row['parent'] and row['name']:
                        self.component_data.append({
                            'parent': row['parent'].strip(),
                            'name': row['name'].strip(),
                            'object': row['object'].strip() if row['object'] else ''
                        })
        except Exception as e:
            print(f"Error loading components: {e}")
    
    def _populate_icons(self):
        for i in reversed(range(self.scroll_layout.count())):
            widget = self.scroll_layout.itemAt(i).widget()
            if widget:
                widget.deleteLater()
        
        self.icon_buttons.clear()
        
        grouped = {}
        for component in self.component_data:
            parent = component['parent']
            if parent not in grouped:
                grouped[parent] = []
            grouped[parent].append(component)
        
        for parent_name in sorted(grouped.keys()):
            category_label = QLabel(parent_name)
            category_label.setStyleSheet("""
                QLabel {
                    font-size: 8pt;
                    padding: 5px;
                    background-color: #f0f0f0;
                    border-radius: 3px;
                }
            """)
            self.scroll_layout.addWidget(category_label)
            
            grid_widget = QWidget()
            grid_layout = QGridLayout(grid_widget)
            grid_layout.setSpacing(5)
            grid_layout.setContentsMargins(5, 5, 5, 5)
            grid_layout.setAlignment(Qt.AlignLeft)
            
            row, col = 0, 0
            max_cols = 5
            
            for component in sorted(grouped[parent_name], key=lambda x: x['name']):
                icon_path = self._get_icon_path(parent_name, component['name'])
                
                if os.path.exists(icon_path):
                    button = ComponentButton(component, icon_path)
                    button.setProperty('category', parent_name)
                    button.setProperty('component_name', component['name'])
                    grid_layout.addWidget(button, row, col)
                    self.icon_buttons.append(button)
                    
                    col += 1
                    if col >= max_cols:
                        col = 0
                        row += 1
            
            self.scroll_layout.addWidget(grid_widget)
    
    def _get_icon_path(self, parent, name):
        base_path = os.path.join("ui", "assets", "png", parent)
        return os.path.join(base_path, f"{name}.png")
    
    def _filter_icons(self, search_text):
        search_text = search_text.lower()
        
        for button in self.icon_buttons:
            category = button.property('category').lower()
            component = button.property('component_name').lower()
            
            matches = search_text in component or search_text in category
            button.setVisible(matches)
