 // src/utils/loadComponents.ts
import type { ComponentItem, Grip } from "@/store/useEditorStore";
import { componentData } from "@/assets/Component_Datails";

/**
 * Resolve asset path relative to /src/assets
 */
function resolveAssetPath(path?: string) {
  if (!path || path.trim() === "") return "";
  try {
    return new URL(`../assets/${path}`, import.meta.url).href;
  } catch {
    return path;
  }
}

let componentIdCounter = 1;

export function loadComponents(): ComponentItem[] {
  return componentData
    .filter((row) => row.name && row.object)
    .map((row) => {
      let grips: Grip[] | undefined;

      if (row.grips) {
        try {
          grips = JSON.parse(row.grips);
        } catch {
          grips = undefined;
        }
      }

      return {
        id: componentIdCounter++,
        name: row.name.trim(),
        object: row.object.trim(),
        icon: "",
        svg: resolveAssetPath(row.svg),
        class: row.parent?.trim() || "",
        args: [],
        legend: row.legend?.trim() || "",
        suffix: row.suffix?.trim() || "",
        png: row.png ? resolveAssetPath(row.png) : undefined,
        grips,
        isCustom: false,
      };
    });
}
