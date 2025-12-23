import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { ComponentItem } from "@/components/Canvas/types";
import { componentsConfig as initialConfig } from "@/assets/config/items";

interface ComponentContextType {
    components: Record<string, Record<string, ComponentItem>>;
    addComponent: (
        category: string,
        component: ComponentItem
    ) => void;
    updateComponent: (
        oldCategory: string,
        oldName: string,
        newCategory: string,
        newComponent: ComponentItem
    ) => void;
    deleteComponent: (
        category: string,
        name: string
    ) => void;
}

const ComponentContext = createContext<ComponentContextType | undefined>(undefined);

export const ComponentProvider = ({ children }: { children: ReactNode }) => {
    const [components, setComponents] = useState<Record<string, Record<string, ComponentItem>>>(initialConfig);

    // Load from local storage on mount
    useEffect(() => {
        const saved = localStorage.getItem("custom_components");
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                // Merge saved components into initial config
                // We do a deep merge logic here to ensure we don't overwrite standard ones unnecessarily
                // but also allow mapped additions. For simplicity, we'll append to categories.

                setComponents(prev => {
                    const next = { ...prev };
                    Object.keys(parsed).forEach(cat => {
                        if (!next[cat]) next[cat] = {};
                        // Ensure all loaded custom components have the flag
                        const migratedItems = Object.entries(parsed[cat] as Record<string, ComponentItem>).reduce((acc, [key, item]) => {
                            acc[key] = { ...item, isCustom: true };
                            return acc;
                        }, {} as Record<string, ComponentItem>);

                        next[cat] = { ...next[cat], ...migratedItems };
                    });
                    return next;
                });

            } catch (e) {
                console.error("Failed to load components", e);
            }
        }
    }, []);

    const addComponent = (category: string, component: ComponentItem) => {
        setComponents(prev => {
            const componentWithFlag = { ...component, isCustom: true };
            const updated = {
                ...prev,
                [category]: {
                    ...(prev[category] || {}),
                    [component.name]: componentWithFlag
                }
            };
            try {
                const currentSaved = JSON.parse(localStorage.getItem("custom_components") || "{}");
                if (!currentSaved[category]) currentSaved[category] = {};
                currentSaved[category][component.name] = componentWithFlag;
                localStorage.setItem("custom_components", JSON.stringify(currentSaved));
            } catch (e) {
                console.error("Failed to save component", e);
            }
            return updated;
        });
    };

    const deleteComponent = (category: string, name: string) => {
        setComponents(prev => {
            const next = { ...prev };
            if (next[category]) {
                const { [name]: deleted, ...rest } = next[category];
                next[category] = rest;

                // If category empty, maybe remove it? Keeping structure simple for now.
                if (Object.keys(next[category]).length === 0) {
                    // Optionally delete category key if empty, but standard categories should stay.
                }
            }

            try {
                const currentSaved = JSON.parse(localStorage.getItem("custom_components") || "{}");
                if (currentSaved[category]) {
                    delete currentSaved[category][name];
                    if (Object.keys(currentSaved[category]).length === 0) {
                        delete currentSaved[category];
                    }
                    localStorage.setItem("custom_components", JSON.stringify(currentSaved));
                }
            } catch (e) {
                console.error("Failed to delete component", e);
            }

            return next;
        });
    };

    const updateComponent = (oldCategory: string, oldName: string, newCategory: string, newComponent: ComponentItem) => {
        // Atomic update: Delete old -> Add new
        // We do this to handle category changes or name changes easily

        // 1. Delete Logic
        setComponents(prev => {
            // We need to return the final state, so we can't just call deleteComponent() inside setComponents
            // because deleteComponent is async state update relative to this render cycle.
            // So we implement logic inline or chain it.
            // Easier approach: Just modify the 'prev' here for both steps.

            let next = { ...prev };

            // Remove Old
            if (next[oldCategory]) {
                const { [oldName]: deleted, ...rest } = next[oldCategory];
                next[oldCategory] = rest;
            }

            // Add New (with isCustom flag guaranteed)
            const componentWithFlag = { ...newComponent, isCustom: true };
            if (!next[newCategory]) next[newCategory] = {};
            next[newCategory] = { ...next[newCategory], [newComponent.name]: componentWithFlag };

            // Persist (Mirror logic)
            try {
                const currentSaved = JSON.parse(localStorage.getItem("custom_components") || "{}");

                // Delete Old
                if (currentSaved[oldCategory]) {
                    delete currentSaved[oldCategory][oldName];
                    if (Object.keys(currentSaved[oldCategory]).length === 0) delete currentSaved[oldCategory];
                }

                // Add New
                if (!currentSaved[newCategory]) currentSaved[newCategory] = {};
                currentSaved[newCategory][newComponent.name] = componentWithFlag;

                localStorage.setItem("custom_components", JSON.stringify(currentSaved));

            } catch (e) {
                console.error("Failed to update component", e);
            }

            return next;
        });
    };
    return (
        <ComponentContext.Provider value={{ components, addComponent, updateComponent, deleteComponent }}>
            {children}
        </ComponentContext.Provider>
    );
};

export const useComponents = () => {
    const context = useContext(ComponentContext);
    if (!context) {
        throw new Error("useComponents must be used within a ComponentProvider");
    }
    return context;
};
