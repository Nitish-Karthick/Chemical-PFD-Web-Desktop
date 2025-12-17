from PyQt5.QtCore import QPoint, QPointF, QRectF
from PyQt5.QtGui import QPainterPath

class Connection:
    def __init__(self, start_component, start_grip_index, start_side):
        self.start_component = start_component
        self.start_grip_index = start_grip_index
        self.start_side = start_side  # "top", "bottom", "left", "right"
        
        self.end_component = None
        self.end_grip_index = None
        self.end_side = None
        
        # New: Snap Target (Temporary during drag)
        self.snap_component = None 
        self.snap_grip_index = None
        self.snap_side = None

        self.current_pos = QPoint(0, 0) # Used during dragging
        self.path = [] # List of QPointF
        
        # Interactive State
        self.is_selected = False
        self.path_offset = 0.0 # Moves the middle segment
        self.start_adjust = 0.0 # Moves the start stub (ns)
        self.end_adjust = 0.0 # Moves the end stub (pe)

    def set_end_grip(self, component, grip_index, side):
        self.end_component = component
        self.end_grip_index = grip_index
        self.end_side = side

    def set_snap_target(self, component, grip_index, side):
        self.snap_component = component
        self.snap_grip_index = grip_index
        self.snap_side = side

    def clear_snap_target(self):
        self.snap_component = None
        self.snap_grip_index = None
        self.snap_side = None

    def get_start_pos(self):
        # canvas-relative coordinate
        return self.start_component.mapToParent(
            self.start_component.get_grip_position(self.start_grip_index)
        )

    def get_end_pos(self):
        if self.end_component:
            return self.end_component.mapToParent(
                self.end_component.get_grip_position(self.end_grip_index)
            )
        # If snapping, return snap grip pos
        if self.snap_component:
            return self.snap_component.mapToParent(
                self.snap_component.get_grip_position(self.snap_grip_index)
            )
        return self.current_pos
        
    def hit_test(self, pos: QPoint, tolerance=5.0):
        """Checks if the position is near the connection path.
        Returns the index of the first segment hit, or -1 if none.
        """
        if len(self.path) < 2:
            return -1
            
        for i in range(len(self.path) - 1):
            p1 = self.path[i]
            p2 = self.path[i+1]
            
            # Distance from point to line segment
            # Simplified for orthogonal lines
            if abs(p1.x() - p2.x()) < 1.0: # Vertical segment
                min_y = min(p1.y(), p2.y())
                max_y = max(p1.y(), p2.y())
                if min_y - tolerance <= pos.y() <= max_y + tolerance:
                    if abs(pos.x() - p1.x()) <= tolerance:
                        return i
            else: # Horizontal segment
                min_x = min(p1.x(), p2.x())
                max_x = max(p1.x(), p2.x())
                if min_x - tolerance <= pos.x() <= max_x + tolerance:
                    if abs(pos.y() - p1.y()) <= tolerance:
                        return i
        return -1

    def calculate_path(self, obstacles=None):
        """
        Ports the Rule-Based Orthogonal Routing logic from the reference project.
        Determines the path points based on start/end positions and grip directions.
        """
        self.path = [] # Reset
        start_point = QPointF(self.get_start_pos())
        points = [start_point]
        end_point = QPointF(self.get_end_pos())
        
        # OFFSETS
        # Base offset (20) + User Adjustments
        # FIX: Clamp stubs to avoid inverting into component
        off_start = max(10.0, 20.0 + self.start_adjust)
        off_end = max(10.0, 20.0 + self.end_adjust)
        
        # Component Bounds (for smart avoidance)
        sitem = QRectF(self.start_component.geometry())
        if self.end_component:
            eitem = QRectF(self.end_component.geometry())
        elif self.snap_component:
            eitem = QRectF(self.snap_component.geometry())
        else:
            # Fake a small rect around the end point
            eitem = QRectF(end_point.x()-10, end_point.y()-10, 20, 20)

        # 1. Determine "Next to Start" (ns)
        ns = QPointF()
        if self.start_side == "top":
            ns = QPointF(start_point.x(), start_point.y() - off_start)
        elif self.start_side == "bottom":
            ns = QPointF(start_point.x(), start_point.y() + off_start)
        elif self.start_side == "left":
            ns = QPointF(start_point.x() - off_start, start_point.y())
        elif self.start_side == "right":
            ns = QPointF(start_point.x() + off_start, start_point.y())
        else: # Fallback
            ns = QPointF(start_point.x() + off_start, start_point.y())

        # 2. Determine "Previous to End" (pe)
        pe = QPointF()
        
        # Priority: Final End Side -> Snap Side -> Heuristic
        target_side = self.end_side
        if not target_side and self.snap_side:
            target_side = self.snap_side
        if not target_side:
            target_side = self._guess_approach_side(start_point, end_point)
        
        if target_side == "top":
            pe = QPointF(end_point.x(), end_point.y() - off_end)
        elif target_side == "bottom":
            pe = QPointF(end_point.x(), end_point.y() + off_end)
        elif target_side == "left":
            pe = QPointF(end_point.x() - off_end, end_point.y())
        elif target_side == "right":
            pe = QPointF(end_point.x() + off_end, end_point.y())
        else:
             pe = QPointF(end_point.x() - off_end, end_point.y())

        # 3. Intermediate Points Logic (The "Brain")
        # Reuse 'self.path_offset' for the MIDDLE sections
        # For U-turns, we add this to the bounding box edge to give space
        off_mid = 20.0 + self.path_offset 
        effective_end_offset = off_end 

        # Case A: Start Right
        if self.start_side == "right":
            if target_side == "left":
                # Standard Horizontal Connection
                if start_point.x() + off_start < end_point.x() - effective_end_offset:
                     mid_x = (start_point.x() + end_point.x()) / 2 + self.path_offset
                     points.append(QPointF(mid_x, start_point.y()))
                     points.append(QPointF(mid_x, end_point.y()))
                else: 
                     # Overlap or simple Z
                     # Route below the lowest component
                     y = max(sitem.bottom(), eitem.bottom()) + off_mid
                     
                     points.append(ns)
                     points.append(QPointF(ns.x(), y)) 
                     points.append(QPointF(pe.x(), y))
                     points.append(pe)
            
            elif target_side == "top":
                 points.append(ns)
                 points.append(QPointF(ns.x(), pe.y()))
                 points.append(pe)
            
            elif target_side == "bottom":
                 points.append(ns)
                 points.append(QPointF(ns.x(), pe.y()))
                 points.append(pe)
                 
            else: # right -> right (U-turn)
                 # Route to the right of the right-most component
                 x = max(sitem.right(), eitem.right()) + off_mid
                 points.append(ns)
                 points.append(QPointF(x, ns.y()))
                 points.append(QPointF(x, pe.y()))
                 points.append(pe)

        # Case B: Start Left
        elif self.start_side == "left":
            if target_side == "right":
                 if start_point.x() - off_start > end_point.x() + effective_end_offset:
                     mid_x = (start_point.x() + end_point.x()) / 2 + self.path_offset
                     points.append(QPointF(mid_x, start_point.y()))
                     points.append(QPointF(mid_x, end_point.y()))
                 else:
                     # Overlap
                     # Route below
                     y = max(sitem.bottom(), eitem.bottom()) + off_mid
                     
                     points.append(ns)
                     points.append(QPointF(ns.x(), y))
                     points.append(QPointF(pe.x(), y))
                     points.append(pe)
            
            elif target_side == "top":
                 points.append(ns)
                 points.append(QPointF(ns.x(), pe.y()))
                 points.append(pe)
                 
            elif target_side == "bottom":
                 points.append(ns)
                 points.append(QPointF(ns.x(), pe.y())) 
                 points.append(pe)
            
            else: # left -> left
                 # Route to the left of the left-most component
                 x = min(sitem.left(), eitem.left()) - off_mid
                 points.append(ns)
                 points.append(QPointF(x, ns.y()))
                 points.append(QPointF(x, pe.y()))
                 points.append(pe)

        # Case C: Start Top
        elif self.start_side == "top":
            if target_side == "bottom":
                if start_point.y() - off_start > end_point.y() + effective_end_offset:
                    mid_y = (start_point.y() + end_point.y()) / 2 + self.path_offset
                    points.append(QPointF(start_point.x(), mid_y))
                    points.append(QPointF(end_point.x(), mid_y))
                else: 
                     # Overlap -> Route Right
                     x = max(sitem.right(), eitem.right()) + off_mid
                     points.append(ns)
                     points.append(QPointF(x, ns.y()))
                     points.append(QPointF(x, pe.y()))
                     points.append(pe)
            elif target_side == "left":
                 points.append(ns)
                 points.append(QPointF(pe.x(), ns.y()))
                 points.append(pe)
            elif target_side == "right":
                 points.append(ns)
                 points.append(QPointF(pe.x(), ns.y()))
                 points.append(pe)
            else: # top -> top
                 # Route above
                 y = min(sitem.top(), eitem.top()) - off_mid
                 points.append(ns)
                 points.append(QPointF(ns.x(), y))
                 points.append(QPointF(pe.x(), y))
                 points.append(pe)

        # Case D: Start Bottom
        elif self.start_side == "bottom":
             if target_side == "top":
                 if start_point.y() + off_start < end_point.y() - effective_end_offset:
                     mid_y = (start_point.y() + end_point.y()) / 2 + self.path_offset
                     points.append(QPointF(start_point.x(), mid_y))
                     points.append(QPointF(end_point.x(), mid_y))
                 else:
                     # Overlap -> Route Right
                     x = max(sitem.right(), eitem.right()) + off_mid
                     points.append(ns)
                     points.append(QPointF(x, ns.y()))
                     points.append(QPointF(x, pe.y()))
                     points.append(pe)
             elif target_side == "left":
                 points.append(ns)
                 points.append(QPointF(pe.x(), ns.y()))
                 points.append(pe)
             elif target_side == "right":
                 points.append(ns)
                 points.append(QPointF(pe.x(), ns.y()))
                 points.append(pe)
             else: # bottom -> bottom
                 # Route below
                 y = max(sitem.bottom(), eitem.bottom()) + off_mid
                 points.append(ns)
                 points.append(QPointF(ns.x(), y))
                 points.append(QPointF(pe.x(), y))
                 points.append(pe)

        points.append(end_point)
        self.path = points

    def _guess_approach_side(self, start, end):
        # Heuristic to guess optimal entry side when dragging freely
        dx = end.x() - start.x()
        dy = end.y() - start.y()
        
        if abs(dx) > abs(dy):
            return "left" if dx > 0 else "right" # Entering from left means target is to right
        else:
            return "top" if dy > 0 else "bottom"

