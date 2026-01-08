import axios from "axios";

const API_URL = "http://localhost:8000/api";

export interface ApiProject {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  canvas_state?: any;
}

// Axios client with base URL and JSON headers
const client = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Add JWT Authorization header if token exists
client.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token && config.headers) {
    config.headers["Authorization"] = `Bearer ${token}`;
  }
  return config;
});

/**
 * Fetch all projects
 * GET /api/project/
 */
/* GET /api/project/ */
export const fetchProjects = async (): Promise<ApiProject[]> => {
  const res = await client.get("/project/");

  if (!res.data.projects) {
    console.error("Invalid projects API response: ", res.data);
    return [];
  }

  return res.data.projects; // extract the projects array
};

/**
 * Create a new project
 * POST /api/project/
 */
export const createProject = async (
  name: string,
  description?: string | null
): Promise<ApiProject> => {
  const res = await client.post("/project/", { name, description });
  return res.data; // DRF returns the created project
};

/**
 * Update project metadata (name/description)
 * PUT /api/project/:id/
 */
export const updateProjectMeta = async (
  id: number,
  payload: { name: string; description?: string | null }
): Promise<ApiProject> => {
  const res = await client.put(`/project/${id}/`, payload);
  return res.data;
};

/**
 * Delete a project
 * DELETE /api/project/:id/
 */
export const deleteProject = async (id: number): Promise<void> => {
  await client.delete(`/project/${id}/`);
};
