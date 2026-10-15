import { getFreeProviderChain, type FreeProvider } from "@/config/free-models";

/** Free providers that are configured (key set) in this environment, fastest first. */
export function getFreeChain(): FreeProvider[] {
  return getFreeProviderChain(process.env);
}
