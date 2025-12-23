// src/components/Canvas/ConnectionLine.tsx


import { Path } from "react-konva";
import { KonvaEventObject } from "konva/lib/Node";
import { Connection, CanvasItem } from "./types";

interface ConnectionLineProps {
    connection: Connection;
    // We now accept the pre-calculated path points as a prop
    points: number[];
    // We still pass items just in case you need them for other metadata, 
    // but strictly for drawing, we rely on 'points'
    items?: CanvasItem[];
    isSelected?: boolean;
    onSelect?: (e: KonvaEventObject<MouseEvent>) => void;
    // Removed 'allConnections' since collision is now handled in the parent/utils
}

export const ConnectionLine = ({
    connection,
    points: _points, // Unused
    pathData,
    isSelected = false,
    onSelect,
}: ConnectionLineProps & { pathData?: string }) => {

    // Safety check
    if (!pathData) return null;

    // Handlers for hover effects
    const handleMouseEnter = (e: KonvaEventObject<MouseEvent>) => {
        const stage = e.target.getStage();
        if (stage) {
            stage.container().style.cursor = 'pointer';
        }
    };

    const handleMouseLeave = (e: KonvaEventObject<MouseEvent>) => {
        const stage = e.target.getStage();
        if (stage) {
            stage.container().style.cursor = 'default';
        }
    };

    return (
        <>
            {/* 1. HIT AREA (Invisible) */}
            <Path
                data={pathData}
                stroke="transparent"
                strokeWidth={20} // 20px wide clickable area
                onMouseDown={(e) => {
                    e.cancelBubble = true;
                    onSelect?.(e);
                }}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                onTap={onSelect}
            />

            {/* 2. VISIBLE LINE */}
            <Path
                data={pathData}
                stroke={isSelected ? "#3b82f6" : "#64748b"}
                strokeWidth={isSelected ? 3 : 2}
                lineCap="round"
                lineJoin="round"
                listening={false}
                shadowColor="black"
                shadowBlur={isSelected ? 4 : 0}
                shadowOpacity={0.3}
            />
        </>
    );
};