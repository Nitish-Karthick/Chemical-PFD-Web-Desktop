export interface Dimensions {
    width: number;
    height: number;
}

export interface Rect extends Dimensions {
    x: number;
    y: number;
}

/**
 * Calculates the rendered rectangle of an image within a container using "aspect-fit" logic.
 * This logic must remain synchronized between the renderer (CanvasItemImage) and the router (routing.ts).
 */
export const calculateAspectFit = (
    containerWidth: number,
    containerHeight: number,
    naturalWidth?: number,
    naturalHeight?: number
): Rect => {
    // If natural dimensions are missing, fallback to full container
    if (!naturalWidth || !naturalHeight) {
        return {
            x: 0,
            y: 0,
            width: containerWidth,
            height: containerHeight,
        };
    }

    const aspectRatio = naturalWidth / naturalHeight;
    const containerRatio = containerWidth / containerHeight;

    let renderWidth = containerWidth;
    let renderHeight = containerHeight;
    let renderX = 0;
    let renderY = 0;

    if (containerRatio > aspectRatio) {
        // Container is wider than image -> fit height, center horizontally
        renderHeight = containerHeight;
        renderWidth = renderHeight * aspectRatio;
        renderX = (containerWidth - renderWidth) / 2;
    } else {
        // Container is taller/narrower -> fit width, center vertically
        renderWidth = containerWidth;
        renderHeight = renderWidth / aspectRatio;
        renderY = (containerHeight - renderHeight) / 2;
    }

    return {
        x: renderX,
        y: renderY,
        width: renderWidth,
        height: renderHeight,
    };
};
