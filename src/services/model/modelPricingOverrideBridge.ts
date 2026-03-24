type ModelPricingOverrideHandler = (input: unknown) => void;

let modelPricingOverrideHandler: ModelPricingOverrideHandler | null = null;

export function registerModelPricingOverrideHandler(
    handler: ModelPricingOverrideHandler | null
): void {
    modelPricingOverrideHandler = handler;
}

export function applyModelPricingOverrides(input: unknown): void {
    modelPricingOverrideHandler?.(input);
}
