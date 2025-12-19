import { useEffect, useRef } from "react";
import {
  Image as KonvaImage,
  Transformer,
  Circle,
  Group,
  Text,
  Rect,
} from "react-konva";
import useImage from "use-image";
import Konva from "konva";

import { CanvasItemImageProps } from "./types";

const LABEL_HEIGHT = 24;
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
  const [image] = useImage(item.svg || item.icon);
  const groupRef = useRef<Konva.Group>(null);
  const trRef = useRef<Konva.Transformer>(null);

  useEffect(() => {
    if (isSelected && trRef.current && groupRef.current) {
      trRef.current.nodes([groupRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected]);

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
      width: Math.max(5, item.width * scaleX),
      height: Math.max(5, item.height * scaleY),
      rotation: node.rotation(),
    };

    onChange(updatedItem);
    onTransformEnd?.(updatedItem);
  };

  const labelText = item.label || item.name;

  const labelX = item.x;
  const labelY = item.y + item.height + LABEL_OFFSET;

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
        onDragEnd={handleDragEnd}
        onTransformEnd={handleTransformEnd}
      >
        <KonvaImage
          height={item.height}
          image={image}
          width={item.width}
          x={0}
          y={0}
          onClick={onSelect}
          onTap={onSelect}
        />
      </Group>

      {/* ================= LABEL (Visual Only, Behind Everything) ================= */}

      <Text
        align="center"
        fill="#374151"
        fontFamily="Arial, sans-serif"
        fontSize={12}
        height={LABEL_HEIGHT - 4}
        listening={false}
        text={labelText}
        verticalAlign="middle"
        width={item.width}
        x={labelX}
        y={labelY + 2}
      />

      {/* ================= TRANSFORMER ================= */}
      {isSelected && (
        <Transformer
          ref={trRef}
          boundBoxFunc={(oldBox, newBox) => {
            if (newBox.width < 5 || newBox.height < 5) {
              return oldBox;
            }

            return newBox;
          }}
        />
      )}

      {/* ================= GRIPS (Always On Top) ================= */}
      {(isSelected || isDrawingConnection) &&
        item.grips?.map((grip, index) => {
          const gripX = item.x + (grip.x / 100) * item.width;
          const gripY = item.y + ((100 - grip.y) / 100) * item.height;

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
