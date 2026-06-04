import { describe, it, expect } from 'vitest';
import { EmbeddingService } from '../../../src/rag/EmbeddingService';

describe('EmbeddingService', () => {
  describe('buildVocabulary', () => {
    it('should compute IDF weights from a corpus of documents', () => {
      const service = new EmbeddingService();
      const docs = [
        'apple banana orange',
        'apple banana grape',
        'apple mango kiwi'
      ];
      
      service.buildVocabulary(docs);
      
      // 'apple' appears in all 3 docs, so IDF should be low (possibly negative)
      // 'orange' appears in only 1 doc, so IDF should be higher
      const appleWeight = service.getIdf('apple');
      const orangeWeight = service.getIdf('orange');
      
      expect(appleWeight).toBeLessThan(orangeWeight);
      // Terms that appear in at least one doc should have non-zero IDF
      expect(appleWeight).not.toBe(0);
      expect(orangeWeight).toBeGreaterThan(0);
    });

    it('should handle empty corpus gracefully', () => {
      const service = new EmbeddingService();
      service.buildVocabulary([]);
      expect(service.getIdf('anything')).toBe(0);
    });
  });

  describe('embed', () => {
    it('should return a sparse vector as a Map', () => {
      const service = new EmbeddingService();
      service.buildVocabulary(['hello world', 'world peace']);
      
      const vector = service.embed('hello world');
      
      expect(vector).toBeInstanceOf(Map);
      expect(vector.has('hello')).toBe(true);
      expect(vector.has('world')).toBe(true);
      // Since 'hello' only appears in 1 doc and 'world' in 2 docs,
      // 'hello' should have higher IDF weight
      const helloWeight = vector.get('hello') ?? 0;
      const worldWeight = vector.get('world') ?? 0;
      expect(helloWeight).toBeGreaterThan(worldWeight);
    });

    it('should exclude stop words from the vector', () => {
      const service = new EmbeddingService();
      service.buildVocabulary(['the cat sat', 'the dog ran']);
      
      const vector = service.embed('the cat');
      
      // 'the' is a stop word and should be filtered out
      expect(vector.has('the')).toBe(false);
      expect(vector.has('cat')).toBe(true);
    });
  });

  describe('cosineSimilarity', () => {
    it('should return 1.0 for identical vectors', () => {
      const vec = new Map([['a', 1], ['b', 2]]);
      expect(EmbeddingService.cosineSimilarity(vec, vec)).toBeCloseTo(1.0);
    });

    it('should return 0.0 for orthogonal vectors', () => {
      const a = new Map([['x', 1]]);
      const b = new Map([['y', 1]]);
      expect(EmbeddingService.cosineSimilarity(a, b)).toBe(0);
    });

    it('should return values between -1 and 1', () => {
      const a = new Map([['a', 1], ['b', 2]]);
      const b = new Map([['a', 3], ['b', 1]]);
      const sim = EmbeddingService.cosineSimilarity(a, b);
      expect(sim).toBeGreaterThanOrEqual(-1);
      expect(sim).toBeLessThanOrEqual(1);
    });

    it('should handle empty vectors', () => {
      const a = new Map();
      const b = new Map([['x', 1]]);
      expect(EmbeddingService.cosineSimilarity(a, b)).toBe(0);
    });
  });
});
