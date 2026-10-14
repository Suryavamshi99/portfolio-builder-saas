export type StepUpHandler = () => Promise<boolean>;

let activeHandler: StepUpHandler | null = null;

export function registerStepUpHandler(handler: StepUpHandler | null): () => void {
  activeHandler = handler;
  return () => {
    if (activeHandler === handler) {
      activeHandler = null;
    }
  };
}

/**
 * Prompt the administrator to re-confirm credentials (password + TOTP/recovery code)
 * for a destructive action.
 * Resolves to true if step-up succeeded, false if cancelled or failed.
 */
export async function requestStepUp(): Promise<boolean> {
  if (!activeHandler) {
    console.warn("requestStepUp called but no StepUpDialog is mounted/registered");
    return false;
  }
  return activeHandler();
}
