import {
    Modal,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
    Button,
} from "@heroui/react";

interface SaveConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    projectName?: string;
    itemCount?: number;
    connectionCount?: number;
}

export function SaveConfirmationModal({
    isOpen,
    onClose,
    onConfirm,
    projectName = "Untitled Project",
    itemCount = 0,
    connectionCount = 0,
}: SaveConfirmationModalProps) {
    const handleConfirm = () => {
        onConfirm();
        onClose();
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            placement="center"
            size="md"
        >
            <ModalContent>
                {(onModalClose) => (
                    <>
                        <ModalHeader className="flex flex-col gap-1">
                            Save Changes
                        </ModalHeader>
                        <ModalBody>
                            <div className="flex flex-col gap-3">
                                <p className="text-sm">
                                    Are you sure you want to save changes to:
                                </p>
                                <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-lg">
                                    <p className="font-semibold text-base">{projectName}</p>
                                    <div className="flex gap-4 mt-2 text-xs text-gray-600 dark:text-gray-400">
                                        <span>{itemCount} component{itemCount !== 1 ? 's' : ''}</span>
                                        <span>•</span>
                                        <span>{connectionCount} connection{connectionCount !== 1 ? 's' : ''}</span>
                                    </div>
                                </div>
                                <p className="text-xs text-gray-500">
                                    This will update the project.
                                </p>
                            </div>
                        </ModalBody>
                        <ModalFooter>
                            <Button
                                color="default"
                                variant="light"
                                onPress={onModalClose}
                            >
                                Cancel
                            </Button>
                            <Button
                                color="primary"
                                onPress={handleConfirm}
                            >
                                Save Changes
                            </Button>
                        </ModalFooter>
                    </>
                )}
            </ModalContent>
        </Modal>
    );
}
