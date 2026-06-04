import { describe, it, expect } from 'vitest';
import { EmbeddingService } from '../../../src/rag/EmbeddingService';

describe('EmbeddingService extended API', () => {
  describe('addDocument (incremental)', () => {
    it('should add a document and update vocabulary incrementally', () => {
      const service = new EmbeddingService();
      service.addDocument('apple banana orange');
      service.addDocument('apple grape melon');

      const vocabSize = service.getVocabularySize();
      expect(vocabSize).toBeGreaterThan(0);
      // 'apple' appears in both docs, should have lower IDF than 'orange'
      const appleIdf = service.getIdf('apple');
      const orangeIdf = service.getIdf('orange');
      expect(appleIdf).toBeLessThan(orangeIdf);
    });

    it('should track document count across addDocument calls', () => {
      const service = new EmbeddingService();
      service.addDocument('first document');
      service.addDocument('second document');
      service.addDocument('third document');

      // Embedding should work after incremental adds
      const vec = service.embed('first document');
      expect(vec).toBeInstanceOf(Map);
      expect(vec.size).toBeGreaterThan(0);
    });
  });

  describe('exportVocabulary / importVocabulary', () => {
    it('should round-trip vocabulary through export/import', () => {
      const service = new EmbeddingService();
      service.addDocument('alpha bravo charlie');
      service.addDocument('alpha delta echo');

      const exported = service.exportVocabulary();
      expect(exported).toHaveProperty('idf');
      expect(exported).toHaveProperty('documentCount');

      const service2 = new EmbeddingService();
      service2.importVocabulary(exported);

      expect(service2.getVocabularySize()).toBe(service.getVocabularySize());
      expect(service2.getIdf('alpha')).toBeCloseTo(service.getIdf('alpha'));
    });
  });

  describe('getVocabularySize', () => {
    it('should return 0 for empty service', () => {
      const service = new EmbeddingService();
      expect(service.getVocabularySize()).toBe(0);
    });

    it('should return count of unique terms after adding documents', () => {
      const service = new EmbeddingService();
      service.addDocument('hello world');
      expect(service.getVocabularySize()).toBe(2);
    });
  });

  describe('cosineSimilarity (instance)', () => {
    it('should work as an instance method with same result as static', () => {
      const service = new EmbeddingService();
      const a = new Map([['x', 1], ['y', 2]]);
      const b = new Map([['x', 3], ['y', 1]]);

      const staticResult = EmbeddingService.cosineSimilarity(a, b);
      const instanceResult = service.cosineSimilarity(a, b);

      expect(instanceResult).toBeCloseTo(staticResult);
    });
  });
});
