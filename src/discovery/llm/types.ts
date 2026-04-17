export interface LLMCompleteRequest {
  system: string;
  user: string;
  purpose: string;
}

export interface DiscoveryLLM {
  name: string;
  available(): Promise<boolean>;
  complete(request: LLMCompleteRequest): Promise<string>;
}
