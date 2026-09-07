import { env } from "../config/env.js";

export type EmbeddingProvider = {
  embedQuery(query: string): Promise<number[]>;
};

export const embeddingProvider: EmbeddingProvider = {
  async embedQuery(query) {
    if (env.EMBEDDING_PROVIDER === "mock") {
      return createMockEmbedding(query, env.EMBEDDING_DIMENSION);
    }

    return createMockEmbedding(query, env.EMBEDDING_DIMENSION);
  }
};

function createMockEmbedding(input: string, dimension: number) {
  const vector = Array.from({ length: dimension }, () => 0);
  for (let index = 0; index < input.length; index += 1) {
    const charCode = input.charCodeAt(index);
    vector[index % dimension] += (charCode % 97) / 97;
  }

  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vector.map((value) => Number((value / norm).toFixed(6)));
}
