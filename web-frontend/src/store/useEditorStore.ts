// src/store/useEditorStore.ts
import { create } from "zustand";
import {
  ComponentItem,
  CanvasItem,
  Connection,
  CanvasState,
} from "../components/Canvas/types";

/** Global store shape **/



/** Global store shape **/
interface EditorStore {
  editors: Record<string, CanvasState>;

  // lifecycle
  initEditor: (editorId: string, initial?: Partial<CanvasState>) => void;
  removeEditor: (editorId: string) => void;

  // item ops
  addItem: (
    editorId: string,
    component: Omit<ComponentItem, "id">,
    opts?: Partial<
      Pick<CanvasItem, "x" | "y" | "width" | "height" | "rotation">
    >,
  ) => CanvasItem;

  updateItem: (
    editorId: string,
    itemId: number,
    patch: Partial<CanvasItem>,
  ) => void;
  deleteItem: (editorId: string, itemId: number) => void;

  // connection ops
  addConnection: (editorId: string, conn: Omit<Connection, "id">) => Connection;
  updateConnection: (
    editorId: string,
    connectionId: number,
    patch: Partial<Connection>,
  ) => void;
  removeConnection: (editorId: string, connectionId: number) => void;

  // batch operations
  batchUpdateItems: (
    editorId: string,
    updates: { id: number; patch: Partial<CanvasItem> }[],
  ) => void;
  batchDeleteItems: (editorId: string, itemIds: number[]) => void;
  batchRemoveConnections: (editorId: string, connectionIds: number[]) => void;

  // helpers
  getEditorState: (editorId: string) => CanvasState | undefined;
  getItemsInOrder: (editorId: string) => CanvasItem[];
  resetCounts: (editorId: string) => void;

  // persistence hooks (optional)
  hydrateEditor: (editorId: string, state: CanvasState) => void;
  exportEditorJSON: (editorId: string) => any;
  updateCanvasState: (editorId: string, state: CanvasState) => void;
}

function padCount(n: number) {
  return n.toString().padStart(2, "0"); // "01", "02", ...
}

let globalIdCounter = Date.now(); // Initialize with current timestamp

export const useEditorStore = create<EditorStore>((set, get) => ({
  editors: {},

  initEditor: (editorId, initial = {}) =>
    set((s) => {
      if (s.editors[editorId]) return s; // already initialized

      return {
        editors: {
          ...s.editors,
          [editorId]: {
            items: initial.items || [],
            connections: initial.connections || [],
            counts: initial.counts || {},
            sequenceCounter: initial.sequenceCounter || 0,
          },
        },
      };
    }),

  removeEditor: (editorId) =>
    set((s) => {
      const next = { ...s.editors };

      delete next[editorId];

      return { editors: next };
    }),

  // In useEditorStore.ts, update the addItem function:

  addItem: (editorId, component, opts = {}) => {
    // ensure editor exists
    const editor = get().editors[editorId] ?? {
      items: [],
      connections: [],
      counts: {},
      sequenceCounter: 0,
    };

    // create key for counts (prefer object, fallback to name)
    const key = component.object?.trim() || component.name.trim();

    const currentCount = editor.counts[key] ?? 0;
    const nextCount = currentCount + 1;

    const legend = component.legend ?? "";
    const suffix = component.suffix ?? "";

    console.log("Adding component:", {
      name: component.name,
      legend,
      suffix,
      objectKey: key,
      currentCount,
      nextCount,
      padCount: padCount(nextCount)
    });

    // Generate label: Legend + Count + Suffix
    const label = `${legend}-${padCount(nextCount)}-${suffix}`;

    const id = ++globalIdCounter;
    const seq = (editor.sequenceCounter ?? 0) + 1;

    const newItem: CanvasItem = {
      id,
      name: component.name,
      icon: component.icon || "",
      svg: component.svg || "",
      class: component.class || "",
      object: component.object || component.name,
      args: component.args || [],
      objectKey: key,
      label, // This is the formatted label
      legend,
      suffix,
      description: component.description ?? "",
      png: component.png,
      grips: component.grips,
      x: typeof opts.x === "number" ? opts.x : 100,
      y: typeof opts.y === "number" ? opts.y : 100,
      width: typeof opts.width === "number" ? opts.width : 80,
      height: typeof opts.height === "number" ? opts.height : 40,
      rotation: typeof opts.rotation === "number" ? opts.rotation : 0,
      sequence: seq,
      addedAt: Date.now(),
      isCustom: component.isCustom,
    };

    // DEBUG: Log the created item
    console.log("Created CanvasItem:", {
      label: newItem.label,
      legend: newItem.legend,
      suffix: newItem.suffix,
      objectKey: newItem.objectKey
    });

    // update store
    set((s) => ({
      editors: {
        ...s.editors,
        [editorId]: {
          items: [...(s.editors[editorId]?.items ?? editor.items), newItem],
          connections: s.editors[editorId]?.connections ?? editor.connections,
          counts: {
            ...(s.editors[editorId]?.counts ?? editor.counts),
            [key]: nextCount,
          },
          sequenceCounter: seq,
        },
      },
    }));

    return newItem;
  },

  updateItem: (editorId, itemId, patch) => {
    set((s) => {
      const ed = s.editors[editorId];

      if (!ed) return s;

      return {
        editors: {
          ...s.editors,
          [editorId]: {
            ...ed,
            items: ed.items.map((it) =>
              it.id === itemId ? { ...it, ...patch } : it,
            ),
          },
        },
      };
    });
  },

  deleteItem: (editorId, itemId) => {
    set((s) => {
      const ed = s.editors[editorId];

      if (!ed) return s;

      // Also remove connections associated with this item
      const filteredConnections = ed.connections.filter(
        (conn) => conn.sourceItemId !== itemId && conn.targetItemId !== itemId,
      );

      return {
        editors: {
          ...s.editors,
          [editorId]: {
            ...ed,
            items: ed.items.filter((it) => it.id !== itemId),
            connections: filteredConnections,
            // counts are NOT decremented to preserve label uniqueness history
          },
        },
      };
    });
  },

  addConnection: (editorId, conn) => {
    const id = ++globalIdCounter;
    const newConnection: Connection = { id, ...conn };

    set((s) => {
      const ed = s.editors[editorId] ?? {
        items: [],
        connections: [],
        counts: {},
        sequenceCounter: 0,
      };

      return {
        editors: {
          ...s.editors,
          [editorId]: {
            ...ed,
            connections: [...ed.connections, newConnection],
          },
        },
      };
    });

    return newConnection;
  },

  updateConnection: (editorId, connectionId, patch) => {
    set((s) => {
      const ed = s.editors[editorId];

      if (!ed) return s;

      return {
        editors: {
          ...s.editors,
          [editorId]: {
            ...ed,
            connections: ed.connections.map((conn) =>
              conn.id === connectionId ? { ...conn, ...patch } : conn,
            ),
          },
        },
      };
    });
  },

  removeConnection: (editorId, connectionId) => {
    set((s) => {
      const ed = s.editors[editorId];

      if (!ed) return s;

      return {
        editors: {
          ...s.editors,
          [editorId]: {
            ...ed,
            connections: ed.connections.filter((c: Connection) => c.id !== connectionId),
          },
        },
      };
    });
  },

  batchUpdateItems: (editorId: string, updates: { id: number; patch: Partial<CanvasItem> }[]) => {
    set((s: EditorStore) => {
      const ed = s.editors[editorId];
      if (!ed) return s;

      const nextItems = [...ed.items];
      updates.forEach(({ id, patch }) => {
        const index = nextItems.findIndex((it) => it.id === id);
        if (index !== -1) {
          nextItems[index] = { ...nextItems[index], ...patch };
        }
      });

      return {
        editors: {
          ...s.editors,
          [editorId]: {
            ...ed,
            items: nextItems,
          },
        },
      };
    });
  },

  batchDeleteItems: (editorId: string, itemIds: number[]) => {
    set((s: EditorStore) => {
      const ed = s.editors[editorId];
      if (!ed) return s;

      const idsSet = new Set(itemIds);

      // Also remove connections associated with these items
      const filteredConnections = ed.connections.filter(
        (conn: Connection) =>
          !idsSet.has(conn.sourceItemId) && !idsSet.has(conn.targetItemId),
      );

      return {
        editors: {
          ...s.editors,
          [editorId]: {
            ...ed,
            items: ed.items.filter((it: CanvasItem) => !idsSet.has(it.id)),
            connections: filteredConnections,
          },
        },
      };
    });
  },

  batchRemoveConnections: (editorId: string, connectionIds: number[]) => {
    set((s: EditorStore) => {
      const ed = s.editors[editorId];
      if (!ed) return s;

      const idsSet = new Set(connectionIds);

      return {
        editors: {
          ...s.editors,
          [editorId]: {
            ...ed,
            connections: ed.connections.filter((c: Connection) => !idsSet.has(c.id)),
          },
        },
      };
    });
  },

  updateCanvasState: (editorId: string, state: CanvasState) => {
    set((s) => ({
      editors: {
        ...s.editors,
        [editorId]: state,
      },
    }));
  },

  getEditorState: (editorId) => get().editors[editorId],

  getItemsInOrder: (editorId) => {
    const ed = get().editors[editorId];

    if (!ed) return [];

    return [...ed.items].sort((a, b) => a.sequence - b.sequence);
  },

  resetCounts: (editorId) => {
    set((s) => {
      const ed = s.editors[editorId];

      if (!ed) return s;

      return {
        editors: {
          ...s.editors,
          [editorId]: { ...ed, counts: {} },
        },
      };
    });
  },

  hydrateEditor: (editorId, state) =>
    set((s) => ({
      editors: {
        ...s.editors,
        [editorId]: state,
      },
    })),

  exportEditorJSON: (editorId) => {
    const ed = get().editors[editorId];

    return ed ? JSON.parse(JSON.stringify(ed)) : null; // deep copy
  },
}));
