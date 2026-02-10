import { useEffect, useRef } from "react";
import {
  Image as KonvaImage,
  Transformer,
  Circle,
  Group,
  Text,
} from "react-konva";
import useImage from "use-image";
import Konva from "konva";

import { CanvasItemImageProps } from "./types";
import { calculateAspectFit } from "../../utils/layout";

const LABEL_OFFSET = 4;

export const CanvasItemImage = ({
  item,
  isSelected,
  onSelect,
  onChange,
  onDragEnd,
  onTransformEnd,
  onGripMouseDown,
  onGripMouseEnter,
  onGripMouseLeave,
  isDrawingConnection = false,
  hoveredGrip = null,
}: CanvasItemImageProps) => {
  const [image] = useImage(item.svg || item.icon, "anonymous");

  const groupRef = useRef<Konva.Group>(null);
  const trRef = useRef<Konva.Transformer>(null);

  useEffect(() => {
    if (isSelected && trRef.current && groupRef.current) {
      trRef.current.nodes([groupRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected, item.width, item.height, item.x, item.y, item.rotation]);

  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    const updatedItem = {
      ...item,
      x: e.target.x(),
      y: e.target.y(),
    };

    onChange(updatedItem);
    onDragEnd?.(updatedItem);
  };

  const handleTransformEnd = () => {
    const node = groupRef.current;

    if (!node) return;

    const scaleX = node.scaleX();
    const scaleY = node.scaleY();

    node.scaleX(1);
    node.scaleY(1);

    const updatedItem = {
      ...item,
      x: node.x(),
      y: node.y(),
      width: Math.max(5, item.width * Math.abs(scaleX)),
      height: Math.max(5, item.height * Math.abs(scaleY)),
      rotation: node.rotation(),
    };

    onChange(updatedItem);
    onTransformEnd?.(updatedItem);
  };

  const labelText = item.label || item.name;

  const labelX = item.x;
  const labelY = item.y + item.height + LABEL_OFFSET;

  // Calculate aspect-fit dimensions using shared helper
  const { x: renderX, y: renderY, width: renderWidth, height: renderHeight } = calculateAspectFit(
    item.width,
    item.height,
    image?.naturalWidth || item.naturalWidth,
    image?.naturalHeight || item.naturalHeight
  );

  // Sync natural dimensions to item state for routing
  useEffect(() => {
    if (image && (image.naturalWidth !== item.naturalWidth || image.naturalHeight !== item.naturalHeight)) {
      onChange({
        ...item,
        naturalWidth: image.naturalWidth,
        naturalHeight: image.naturalHeight,
      });
    }
  }, [image, item.naturalWidth, item.naturalHeight, onChange, item]);

  return (
    <>
      {/* ================= IMAGE (Selectable / Transformable) ================= */}
      <Group
        ref={groupRef}
        draggable
        height={item.height}
        rotation={item.rotation}
        width={item.width}
        x={item.x}
        y={item.y}
        scaleX={1}
        scaleY={1}
        onDragEnd={handleDragEnd}
        onTransformEnd={handleTransformEnd}
      >
        <KonvaImage
          height={renderHeight}
          image={image || undefined}
          width={renderWidth}
          x={renderX}
          y={renderY}
          onClick={(e) => onSelect(e as any)}
          onTap={(e) => onSelect(e as any)}
        />
      </Group>

      {/* ================= LABEL (Visual Only, Behind Everything) ================= */}

      <Text
        align="center"
        fill="#374151"
        fontFamily="Arial, sans-serif"
        fontSize={12}
        listening={false}
        text={labelText}
        width={item.width + 100} // Increase width to prevent wrapping
        x={labelX + item.width / 2}
        y={labelY + 2}
        offsetX={(item.width + 100) / 2} // Center align
      />

      {/* ================= TRANSFORMER ================= */}
      {isSelected && (
        <Transformer
          ref={trRef}
          rotateEnabled={false} // Disable rotation
          keepRatio={true} // Enforce aspect ratio scaling
          flipEnabled={false} // Disable flipping to prevent negative scale issues
          enabledAnchors={[
            'top-left',
            'top-right',
            'bottom-left',
            'bottom-right',
          ]}
          boundBoxFunc={(oldBox, newBox) => {
            // Prevent shrinking too small
            if (newBox.width < 10 || newBox.height < 10) {
              return oldBox;
            }
            return newBox;
          }}
        />
      )}

      {/* ================= GRIPS (Always On Top) ================= */}
      {(isSelected || isDrawingConnection) &&
        item.grips?.map((grip, index) => {
          // Grips are positioned relative to the RENDERED image, not the container box
          const gripX = (item.x + renderX) + (grip.x / 100) * renderWidth;
          const gripY = (item.y + renderY) + ((100 - grip.y) / 100) * renderHeight;

          const isHovered =
            hoveredGrip?.itemId === item.id && hoveredGrip?.gripIndex === index;

          return (
            <Circle
              key={index}
              listening
              fill={isHovered ? "#22c55e" : "#3b82f6"}
              opacity={isDrawingConnection && !isSelected ? 0.7 : 1}
              radius={isDrawingConnection ? 6 : 5}
              stroke="#ffffff"
              strokeWidth={isHovered ? 3 : 2}
              x={gripX}
              y={gripY}
              onMouseDown={(e) => {
                e.cancelBubble = true;
                onGripMouseDown?.(item.id, index, gripX, gripY);
              }}
              onMouseEnter={(e) => {
                onGripMouseEnter?.(item.id, index);
                e.target
                  .getStage()
                  ?.container()
                  .style.setProperty("cursor", "pointer");
              }}
              onMouseLeave={(e) => {
                onGripMouseLeave?.();
                e.target
                  .getStage()
                  ?.container()
                  .style.setProperty("cursor", "default");
              }}
            />
          );
        })}
    </>
  );
};
