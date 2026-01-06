// Project storage utilities for localStorage
// Data structure matches Django backend API for easy migration

const STORAGE_KEY = 'pfd_projects';
let nextProjectId = Date.now(); // Simple ID generation for localStorage

// Backend-compatible project structure
export interface ProjectMetadata {
    id: number;
    name: string;
    description: string | null;
    created_at: string;  // ISO timestamp
    updated_at: string;  // ISO timestamp
}

export interface BackendCanvasItem {
    id: number;
    project: number;
    component_id?: number;
    label: string;
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
    scaleX: number;
    scaleY: number;
    sequence: number;
    // Component info (from component library)
    s_no?: string;
    parent?: string;
    name?: string;
    svg?: string;
    png?: string;
    object?: string;
    legend?: string;
    suffix?: string;
    grips?: any[];
}

export interface BackendConnection {
    id: number;
    sourceItemId: number;
    sourceGripIndex: number;
    targetItemId: number;
    targetGripIndex: number;
    waypoints: { x: number; y: number }[];
}

export interface CanvasState {
    items: BackendCanvasItem[];
    connections: BackendConnection[];
    sequence_counter: number;
}

export interface SavedProject extends ProjectMetadata {
    canvas_state: CanvasState;
    viewport?: {
        scale: number;
        position: { x: number; y: number };
        gridSize: number;
        showGrid: boolean;
        snapToGrid: boolean;
    };
}

/**
 * Get all projects from localStorage
 */
export function getProjects(): SavedProject[] {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        if (!data) return [];

        const projects = JSON.parse(data);
        return Array.isArray(projects) ? projects : [];
    } catch (error) {
        console.error('Error loading projects from localStorage:', error);
        return [];
    }
}

/**
 * Get a single project by ID
 */
export function getProject(id: number): SavedProject | null {
    const projects = getProjects();
    return projects.find(p => p.id === id) || null;
}

/**
 * Save or update a project
 */
export function saveProject(project: SavedProject): SavedProject {
    try {
        const projects = getProjects();
        const existingIndex = projects.findIndex(p => p.id === project.id);

        // Update timestamp
        project.updated_at = new Date().toISOString();

        if (existingIndex >= 0) {
            // Update existing project
            projects[existingIndex] = project;
        } else {
            // Add new project
            projects.push(project);
        }

        localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
        return project;
    } catch (error) {
        console.error('Error saving project to localStorage:', error);
        throw error;
    }
}

/**
 * Delete a project
 */
export function deleteProject(id: number): boolean {
    try {
        const projects = getProjects();
        const filtered = projects.filter(p => p.id !== id);

        if (filtered.length === projects.length) {
            return false; // Project not found
        }

        localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
        return true;
    } catch (error) {
        console.error('Error deleting project from localStorage:', error);
        return false;
    }
}

/**
 * Create a new project with metadata
 */
export function createProject(name: string, description: string | null = null): SavedProject {
    const now = new Date().toISOString();
    const id = nextProjectId++;

    const project: SavedProject = {
        id,
        name,
        description,
        created_at: now,
        updated_at: now,
        canvas_state: {
            items: [],
            connections: [],
            sequence_counter: 0,
        },
        viewport: {
            scale: 1,
            position: { x: 0, y: 0 },
            gridSize: 20,
            showGrid: true,
            snapToGrid: true,
        },
    };

    return saveProject(project);
}

/**
 * Convert zustand CanvasState to backend format
 * This helper maps the local editor state to backend-compatible format
 */
export function convertToBackendFormat(
    projectId: number,
    localItems: any[],
    localConnections: any[],
    sequenceCounter: number
): CanvasState {
    const items: BackendCanvasItem[] = localItems.map(item => ({
        id: item.id,
        project: projectId,
        component_id: item.component_id,
        label: item.label || '',
        x: item.x,
        y: item.y,
        width: item.width,
        height: item.height,
        rotation: item.rotation || 0,
        scaleX: item.scaleX || 1,
        scaleY: item.scaleY || 1,
        sequence: item.sequence,
        // Include component metadata
        s_no: item.s_no,
        parent: item.parent,
        name: item.name,
        svg: item.svg,
        png: item.png,
        object: item.object,
        legend: item.legend,
        suffix: item.suffix,
        grips: item.grips,
    }));

    const connections: BackendConnection[] = localConnections.map(conn => ({
        id: conn.id,
        sourceItemId: conn.sourceItemId,
        sourceGripIndex: conn.sourceGripIndex,
        targetItemId: conn.targetItemId,
        targetGripIndex: conn.targetGripIndex,
        waypoints: conn.waypoints || [],
    }));

    return {
        items,
        connections,
        sequence_counter: sequenceCounter,
    };
}
