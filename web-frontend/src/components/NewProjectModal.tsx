import { useState } from "react";
import {
    Modal,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
    Button,
    Input,
    Textarea,
} from "@heroui/react";

interface NewProjectModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreate: (name: string, description: string) => void;
}

export function NewProjectModal({
    isOpen,
    onClose,
    onCreate,
}: NewProjectModalProps) {
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [nameError, setNameError] = useState("");

    const handleCreate = () => {
        // Validate project name
        if (!name.trim()) {
            setNameError("Project name is required");
            return;
        }

        onCreate(name.trim(), description.trim());

        // Reset form
        setName("");
        setDescription("");
        setNameError("");
        onClose();
    };

    const handleClose = () => {
        // Reset form on close
        setName("");
        setDescription("");
        setNameError("");
        onClose();
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={handleClose}
            placement="center"
            size="lg"
        >
            <ModalContent>
                {() => (
                    <>
                        <ModalHeader className="flex flex-col gap-1">
                            Create New Project
                        </ModalHeader>
                        <ModalBody>
                            <div className="flex flex-col gap-4">
                                <Input
                                    autoFocus
                                    label="Project Name"
                                    placeholder="Enter project name"
                                    value={name}
                                    onChange={(e) => {
                                        setName(e.target.value);
                                        setNameError("");
                                    }}
                                    isInvalid={!!nameError}
                                    errorMessage={nameError}
                                    variant="bordered"
                                    isRequired
                                />
                                <Textarea
                                    label="Description"
                                    placeholder="Enter project description (optional)"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    variant="bordered"
                                    minRows={3}
                                    maxRows={6}
                                />
                                <p className="text-xs text-gray-500">
                                    You can edit the project name and description later from the editor.
                                </p>
                            </div>
                        </ModalBody>
                        <ModalFooter>
                            <Button
                                color="danger"
                                variant="light"
                                onPress={handleClose}
                            >
                                Cancel
                            </Button>
                            <Button
                                color="primary"
                                onPress={handleCreate}
                            >
                                Create Project
                            </Button>
                        </ModalFooter>
                    </>
                )}
            </ModalContent>
        </Modal>
    );
}
