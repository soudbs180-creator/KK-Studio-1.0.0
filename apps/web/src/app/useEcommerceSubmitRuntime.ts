import { useCallback } from 'react';

export interface EcommerceSubmitGuardState {
  isEcommerce: boolean;
}

export interface UseEcommerceSubmitRuntimeDeps {
  hasEcommerceAnalysis: boolean;
  analysisConfirmed: boolean;
  handleAnalyzeEcommerceRequirement: () => Promise<void>;
  handleConfirmEcommerceAnalysis: () => Promise<void>;
}

export interface UseEcommerceSubmitRuntimeResult {
  handleEcommerceSubmitGuard: (submitGuard: EcommerceSubmitGuardState) => Promise<boolean>;
}

export function useEcommerceSubmitRuntime({
  hasEcommerceAnalysis,
  analysisConfirmed,
  handleAnalyzeEcommerceRequirement,
  handleConfirmEcommerceAnalysis,
}: UseEcommerceSubmitRuntimeDeps): UseEcommerceSubmitRuntimeResult {
  const handleEcommerceSubmitGuard = useCallback(async (submitGuard: EcommerceSubmitGuardState) => {
    if (!submitGuard.isEcommerce) {
      return false;
    }

    if (!hasEcommerceAnalysis) {
      await handleAnalyzeEcommerceRequirement();
      return true;
    }

    if (analysisConfirmed) {
      return true;
    }

    await handleConfirmEcommerceAnalysis();
    return true;
  }, [analysisConfirmed, handleAnalyzeEcommerceRequirement, handleConfirmEcommerceAnalysis, hasEcommerceAnalysis]);

  return {
    handleEcommerceSubmitGuard,
  };
}
