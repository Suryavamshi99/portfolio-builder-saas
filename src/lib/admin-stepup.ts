// replaced by 08c
/**
 * Step-up authentication coordination for destructive admin actions.
 * Stubs handoff 08c contract until 08c is merged.
 */

export type StepUpHandler = () => Promise<boolean>;

let activeStepUpHandler: StepUpHandler | null = null;

export function registerStepUpHandler(handler: StepUpHandler): () => void {
  activeStepUpHandler = handler;
  return () => {
    if (activeStepUpHandler === handler) {
      activeStepUpHandler = null;
    }
  };
}

export async function requestStepUp(): Promise<boolean> {
  if (activeStepUpHandler) {
    return await activeStepUpHandler();
  }
  return false;
}
