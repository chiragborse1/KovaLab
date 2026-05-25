import type { KovaConfig } from "../config/types.kova.js";
import { listRegisteredMemoryEmbeddingProviders, type MemoryEmbeddingProviderAdapter } from "./memory-embedding-providers.js";
export { listRegisteredMemoryEmbeddingProviders };
export declare function listRegisteredMemoryEmbeddingProviderAdapters(): MemoryEmbeddingProviderAdapter[];
export declare function listMemoryEmbeddingProviders(cfg?: KovaConfig): MemoryEmbeddingProviderAdapter[];
export declare function getMemoryEmbeddingProvider(id: string, cfg?: KovaConfig): MemoryEmbeddingProviderAdapter | undefined;
