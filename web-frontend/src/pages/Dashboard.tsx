import {
  Button,
  Card,
  CardHeader,
  CardBody,
  CardFooter,
  Divider,
  Chip,
  Input,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Textarea,
} from "@heroui/react";
import { useNavigate } from "react-router-dom";
import { useState, useMemo, useEffect } from "react";
import { CiFilter } from "react-icons/ci";
import { MdEdit, MdDelete } from "react-icons/md";

import { NewProjectModal } from "@/components/NewProjectModal";
// import {
//   getProjects,
//   createProject,
//   deleteProject,
//   saveProject,
//   SavedProject,
// } from "@/utils/projectStorage";
import {
  fetchProjects,
  createProject,
  deleteProject,
  updateProjectMeta,
} from "@/api/projectApi";
import { SavedProject } from "@/utils/projectStorage";

export interface Project {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  canvas_state?: {
    items?: any[];
  };
}
export default function Dashboard() {
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("recent");
  const [sizeFilter, setSizeFilter] = useState("all");
  const [projects, setProjects] = useState<SavedProject[]>(() => []);

  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [editingProject, setEditingProject] = useState<SavedProject | null>(
    null,
  );
  const [deletingProject, setDeletingProject] = useState<SavedProject | null>(
    null,
  );
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");

  // useEffect(() => {
  //   const loadedProjects = getProjects();

  //   setProjects(Array.isArray(loadedProjects) ? loadedProjects : []);
  // }, []);

  // Load projects from localStorage on mount
  // useEffect(() => {
  //   const loadedProjects = getProjects();

  //   setProjects(loadedProjects);
  // }, []);

  // const handleCreateNewProject = (name: string, description: string) => {
  //   // Create project in localStorage
  //   const newProject = createProject(name, des  // useEffect(() => {
  //   const loadedProjects = getProjects();

  //   setProjects(loadedProjects);
  // }, []);cription || null);

  //   // Update local state
  //   setProjects((prev) => [...prev, newProject]);

  //   // Navigate to editor
  //   navigate(`/editor/${newProject.id}`);
  // };

  const handleEditProject = (project: SavedProject) => {
    setEditingProject(project);
    setEditName(project.name);
    setEditDescription(project.description || "");
  };

  // const handleSaveEdit = () => {
  //   if (!editingProject) return;

  //   const updatedProject = {
  //     ...editingProject,
  //     name: editName,
  //     description: editDescription || null,
  //   };

  //   saveProject(updatedProject);
  //   setProjects((prev) =>
  //     prev.map((p) => (p.id === updatedProject.id ? updatedProject : p)),
  //   );
  //   setEditingProject(null);
  // };

  const handleDeleteProject = (project: SavedProject) => {
    setDeletingProject(project);
  };

  // const confirmDelete = () => {
  //   if (!deletingProject) return;

  //   deleteProject(deletingProject.id);
  //   setProjects((prev) => prev.filter((p) => p.id !== deletingProject.id));
  //   setDeletingProject(null);
  // };

  const filteredProjects = useMemo(() => {
    let list = [...projects];

    if (search.trim() !== "") {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(search.toLowerCase()) ||
          (p.description &&
            p.description.toLowerCase().includes(search.toLowerCase())),
      );
    }

    if (sortBy === "alpha") {
      list.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      // Sort by most recent (updated_at)
      list.sort(
        (a, b) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
      );
    }

    // Optional: size filter based on number of items
    if (sizeFilter !== "all") {
      list = list.filter((p) => {
        const itemCount = p.canvas_state?.items?.length || 0;

        if (sizeFilter === "small") return itemCount < 5;
        if (sizeFilter === "medium") return itemCount >= 5 && itemCount < 15;
        if (sizeFilter === "large") return itemCount >= 15;

        return true;
      });
    }

    return list;
  }, [search, sortBy, sizeFilter, projects]);

  // Helper to format relative time
  const getRelativeTime = (isoDate: string) => {
    const date = new Date(isoDate);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? "s" : ""} ago`;
    if (diffHours < 24) return `${diffHours} hr${diffHours > 1 ? "s" : ""} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;

    return date.toLocaleDateString();
  };

  // Get project status based on item count
  const getProjectStatus = (project: SavedProject) => {
    const itemCount = project.canvas_state?.items?.length || 0;

    if (itemCount === 0) return "Draft";
    if (itemCount < 10) return "In Progress";

    return "Complete";
  };

useEffect(() => {
  fetchProjects()
    .then((data) => {
      if (Array.isArray(data)) {
        setProjects(data);
      } else if (Array.isArray(data?.projects)) {
        setProjects(data.projects);
      } else {
        console.error("Invalid projects API response:", data);
        setProjects([]);
      }
    })
    .catch((err) => {
      console.error("Failed to fetch projects:", err);
      setProjects([]);
    });
}, []);


  const handleCreateNewProject = async (name: string, description: string) => {
    const project = await createProject(name, description || null);

    setProjects((prev) => [...prev, project]);
    navigate(`/editor/${project.id}`);
  };
  const handleSaveEdit = async () => {
    if (!editingProject) return;

    await updateProjectMeta(editingProject.id, {
      name: editName,
      description: editDescription || null,
    });

    setProjects((prev) =>
      prev.map((p) =>
        p.id === editingProject.id
          ? { ...p, name: editName, description: editDescription }
          : p,
      ),
    );

    setEditingProject(null);
  };
  const confirmDelete = async () => {
    if (!deletingProject) return;

    await deleteProject(deletingProject.id);
    setProjects((prev) => prev.filter((p) => p.id !== deletingProject.id));

    setDeletingProject(null);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header Section */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">My Projects</h1>
          <p className="text-gray-500">Manage your PFD diagrams</p>
        </div>
        <Button color="primary" onPress={() => setShowNewProjectModal(true)}>
          + New Diagram
        </Button>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <Input
          isClearable
          placeholder="Search projects..."
          radius="lg"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {/* Combined Filter Dropdown */}
        <Dropdown>
          <DropdownTrigger>
            <Button
              isIconOnly
              className="text-foreground hover:text-primary"
              variant="light"
            >
              <CiFilter size={22} />
            </Button>
          </DropdownTrigger>
          <DropdownMenu aria-label="Filter and sort options">
            {/* Sort Section */}
            <DropdownItem
              key="sort-header"
              isReadOnly
              className="text-xs font-semibold opacity-70"
            >
              Sort By
            </DropdownItem>
            <DropdownItem
              key="recent"
              className={sortBy === "recent" ? "bg-primary/10" : ""}
              onPress={() => setSortBy("recent")}
            >
              Most Recent
            </DropdownItem>
            <DropdownItem
              key="alpha"
              className={sortBy === "alpha" ? "bg-primary/10" : ""}
              onPress={() => setSortBy("alpha")}
            >
              Alphabetical
            </DropdownItem>

            <DropdownItem key="divider" isReadOnly className="opacity-0" />

            {/* Size Filter Section */}
            <DropdownItem
              key="size-header"
              isReadOnly
              className="text-xs font-semibold opacity-70"
            >
              Size Filter
            </DropdownItem>
            <DropdownItem
              key="all"
              className={sizeFilter === "all" ? "bg-primary/10" : ""}
              onPress={() => setSizeFilter("all")}
            >
              All Projects
            </DropdownItem>
            <DropdownItem
              key="small"
              className={sizeFilter === "small" ? "bg-primary/10" : ""}
              onPress={() => setSizeFilter("small")}
            >
              Small (&lt; 5 items)
            </DropdownItem>
            <DropdownItem
              key="medium"
              className={sizeFilter === "medium" ? "bg-primary/10" : ""}
              onPress={() => setSizeFilter("medium")}
            >
              Medium (5-14 items)
            </DropdownItem>
            <DropdownItem
              key="large"
              className={sizeFilter === "large" ? "bg-primary/10" : ""}
              onPress={() => setSizeFilter("large")}
            >
              Large (15+ items)
            </DropdownItem>
          </DropdownMenu>
        </Dropdown>
      </div>

      <Divider />

      {/* Projects Grid */}
      {filteredProjects.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-6xl mb-4">📄</div>
          <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
            {projects.length === 0 ? "No projects yet" : "No projects for search result"}
          </h2>
          <p className="text-gray-500 mb-6">
            {projects.length === 0
              ? "Create your first PFD diagram to get started"
              : "Try adjusting your search or filters"}
          </p>
          {projects.length === 0 && (
            <Button
              color="primary"
              size="lg"
              onPress={() => setShowNewProjectModal(true)}
            >
              + Create New Project
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProjects.map((proj) => (
            <Card
              key={proj.id}
              isPressable
              className="p-2 hover:scale-[1.01] transition-transform cursor-pointer"
              onPress={() => navigate(`/editor/${proj.id}`)}
            >
              <CardHeader className="flex gap-3">
                <div className="bg-primary/10 p-2 rounded-lg text-2xl">📄</div>
                <div className="flex flex-col flex-grow">
                  <p className="text-md font-bold">{proj.name}</p>
                  <p className="text-small text-default-500">
                    Edited {getRelativeTime(proj.updated_at)}
                  </p>
                </div>
                <div
                  className="flex gap-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Button
                    isIconOnly
                    className="text-gray-600 hover:text-blue-600 hover:bg-blue-100/50 dark:hover:bg-blue-900/30"
                    size="sm"
                    variant="light"
                    onPress={() => handleEditProject(proj)}
                  >
                    <MdEdit size={18} />
                  </Button>
                  <Button
                    isIconOnly
                    className="text-gray-600 hover:text-red-600 hover:bg-red-100/50 dark:hover:bg-red-900/30"
                    size="sm"
                    variant="light"
                    onPress={() => handleDeleteProject(proj)}
                  >
                    <MdDelete size={18} />
                  </Button>
                </div>
              </CardHeader>
              <Divider />
              <CardBody>
                <p className="text-gray-500 text-sm line-clamp-2">
                  {proj.description || "No description provided"}
                </p>
              </CardBody>
              <CardFooter className="flex justify-between">
                <Chip
                  color={
                    getProjectStatus(proj) === "Complete"
                      ? "success"
                      : "warning"
                  }
                  size="sm"
                  variant="flat"
                >
                  {getProjectStatus(proj)}
                </Chip>
                <span className="text-primary text-sm font-medium">
                  Click to open →
                </span>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* New Project Modal */}
      <NewProjectModal
        isOpen={showNewProjectModal}
        onClose={() => setShowNewProjectModal(false)}
        onCreate={handleCreateNewProject}
      />

      {/* Edit Project Modal */}
      <Modal
        isOpen={!!editingProject}
        placement="center"
        onClose={() => setEditingProject(null)}
      >
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            Edit Project
          </ModalHeader>
          <ModalBody>
            <Input
              autoFocus
              label="Project Name"
              placeholder="Enter project name"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
            />
            <Textarea
              label="Description (Optional)"
              placeholder="Enter project description"
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => setEditingProject(null)}>
              Cancel
            </Button>
            <Button
              color="primary"
              isDisabled={!editName.trim()}
              onPress={handleSaveEdit}
            >
              Save Changes
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deletingProject}
        placement="center"
        onClose={() => setDeletingProject(null)}
      >
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            Delete Project
          </ModalHeader>
          <ModalBody>
            <p>
              Are you sure you want to delete{" "}
              <strong>{deletingProject?.name}</strong>?
            </p>
            <p className="text-sm text-gray-500">
              This action cannot be undone. All diagram data will be permanently
              removed.
            </p>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => setDeletingProject(null)}>
              Cancel
            </Button>
            <Button color="danger" onPress={confirmDelete}>
              Delete Project
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
