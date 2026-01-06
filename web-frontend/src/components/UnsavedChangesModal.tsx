import {
    Modal,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
    Button,
} from "@heroui/react";

interface UnsavedChangesModalProps {
    isOpen: boolean;
    onClose: () => void;
    context: 'navigation' | 'newProject';
    onSaveAndProceed: () => void;
    onDiscardAndProceed: () => void;
    projectName?: string;
}

export function UnsavedChangesModal({
    isOpen,
    onClose,
    context,
    onSaveAndProceed,
    onDiscardAndProceed,
    projectName = "Untitled Project",
}: UnsavedChangesModalProps) {
    const getContextText = () => {
        if (context === 'navigation') {
            return {
                title: "Unsaved Changes",
                message: "You have unsaved changes in this project. What would you like to do?",
                saveButton: "Save & Go Back",
                discardButton: "Discard & Go Back",
            };
        } else {
            return {
                title: "Unsaved Changes",
                message: "You have unsaved changes in the current project. What would you like to do?",
                saveButton: "Save & Create New",
                discardButton: "Discard & Create New",
            };
        }
    };

    const text = getContextText();

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            placement="center"
            size="md"
            isDismissable={false}
        >
            <ModalContent>
                {() => (
                    <>
                        <ModalHeader className="flex flex-col gap-1">
                            {text.title}
                        </ModalHeader>
                        <ModalBody>
                            <div className="flex flex-col gap-3">
                                <p className="text-sm">
                                    {text.message}
                                </p>
                                <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-lg">
                                    <p className="font-semibold text-base">{projectName}</p>
                                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                        has unsaved modifications
                                    </p>
                                </div>
                            </div>
                        </ModalBody>
                        <ModalFooter className="flex justify-between">
                            <Button
                                color="danger"
                                variant="light"
                                onPress={() => {
                                    onDiscardAndProceed();
                                    onClose();
                                }}
                            >
                                {text.discardButton}
                            </Button>
                            <div className="flex gap-2">
                                <Button
                                    color="default"
                                    variant="light"
                                    onPress={onClose}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    color="primary"
                                    onPress={() => {
                                        onSaveAndProceed();
                                        onClose();
                                    }}
                                >
                                    {text.saveButton}
                                </Button>
                            </div>
                        </ModalFooter>
                    </>
                )}
            </ModalContent>
        </Modal>
    );
}
