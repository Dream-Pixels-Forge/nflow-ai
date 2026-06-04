/**
 * EmbeddingService - TF-IDF based sparse embeddings
 *
 * Provides browser-native embeddings using TF-IDF (Term Frequency-Inverse Document Frequency).
 * No external models required - works entirely in-browser.
 */

// Stop words to reduce noise in embeddings
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'is', 'it', 'this', 'that', 'are', 'was',
  'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
  'will', 'would', 'could', 'should', 'may', 'might', 'shall', 'can',
  'not', 'no', 'nor', 'if', 'then', 'else', 'when', 'where', 'how',
  'what', 'which', 'who', 'whom', 'why', 'all', 'each', 'every', 'both',
  'few', 'more', 'most', 'other', 'some', 'such', 'than', 'too', 'very',
  'just', 'about', 'above', 'after', 'again', 'also', 'am', 'any', 'as',
  'because', 'before', 'below', 'between', 'up', 'down', 'out', 'over',
  'own', 'same', 'so', 'only', 'into', 'through', 'during', 'while'
]);

export class EmbeddingService {
  private idf: Map<string, number> = new Map();
  private documentCount: number = 0;

  /**
   * Tokenize text into terms (lowercase, alphanumeric, min length 2)
   */
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(t => t.length >= 2 && !STOP_WORDS.has(t));
  }

  /**
   * Compute IDF weights from a corpus of documents.
   * IDF(t) = log(N / (1 + df(t))) where df(t) = number of docs containing t
   */
  buildVocabulary(documents: string[]): void {
    this.idf.clear();
    this.documentCount = documents.length;

    if (documents.length === 0) return;

    // Count document frequency for each term
    const df = new Map<string, number>();
    
    for (const doc of documents) {
      const uniqueTerms = new Set(this.tokenize(doc));
      for (const term of uniqueTerms) {
        df.set(term, (df.get(term) || 0) + 1);
      }
    }

    // Compute IDF: log(N / (1 + df))
    const N = documents.length;
    for (const [term, freq] of df) {
      this.idf.set(term, Math.log(N / (1 + freq)));
    }
  }

  /**
   * Get IDF weight for a term (returns 0 if not in vocabulary)
   */
  getIdf(term: string): number {
    return this.idf.get(term.toLowerCase()) || 0;
  }

  /**
   * Embed text into a sparse vector using TF-IDF.
   * Returns Map<term, weight> where weight = TF * IDF
   */
  embed(text: string): Map<string, number> {
    const tokens = this.tokenize(text);
    const vector = new Map<string, number>();
    
    // Term frequency (raw count, normalized by doc length)
    const tf = new Map<string, number>();
    for (const token of tokens) {
      tf.set(token, (tf.get(token) || 0) + 1);
    }

    // TF-IDF weight = TF * IDF
    for (const [term, count] of tf) {
      const idfWeight = this.idf.get(term) || 0;
      // Normalize TF by document length
      const normalizedTf = count / tokens.length;
      vector.set(term, normalizedTf * idfWeight);
    }

    return vector;
  }

  /**
   * Compute cosine similarity between two sparse vectors.
   * Returns value in [-1, 1], typically [0, 1] for positive weights.
   */
  static cosineSimilarity(a: Map<string, number>, b: Map<string, number>): number {
    if (a.size === 0 || b.size === 0) return 0;

    // Dot product
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    // Compute norms and dot product
    for (const [term, weight] of a) {
      normA += weight * weight;
      const bWeight = b.get(term);
      if (bWeight !== undefined) {
        dotProduct += weight * bWeight;
      }
    }

    for (const weight of b.values()) {
      normB += weight * weight;
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    if (denominator === 0) return 0;

    return dotProduct / denominator;
  }

  /**
   * Get vocabulary size
   */
  getVocabSize(): number {
    return this.idf.size;
  }

  /**
   * Get vocabulary as a serializable object for IndexedDB persistence
   */
  toSerializable(): { idf: Record<string, number>; documentCount: number } {
    const idfObj: Record<string, number> = {};
    for (const [term, weight] of this.idf) {
      idfObj[term] = weight;
    }
    return { idf: idfObj, documentCount: this.documentCount };
  }

  /**
   * Restore from serialized data
   */
  fromSerializable(data: { idf: Record<string, number>; documentCount: number }): void {
    this.idf.clear();
    this.documentCount = data.documentCount;
    for (const [term, weight] of Object.entries(data.idf)) {
      this.idf.set(term, weight);
    }
  }
}
