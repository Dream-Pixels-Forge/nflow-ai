# RAG Vector Search

## Task
Build an in-browser RAG (Retrieval Augmented Generation) system that indexes conversation history and code context for semantic search, improving agent responses.

## Requirements
1. Create `src/rag/EmbeddingService.ts`:
   - Use browser-native embeddings via a lightweight TF-IDF approach (no external models)
   - `embed(text)`: returns sparse vector (TF-IDF weighted term frequencies)
   - `cosineSimilarity(a, b)`: compute similarity between two vectors
   - Store vocabulary globally, compute IDF weights from corpus

2. Create `src/rag/VectorStore.ts`:
   - In-memory vector store with IndexedDB persistence
   - `addDocument(id, text, metadata)`: embed and store
   - `search(query, topK)`: return top-K most similar documents
   - `removeDocument(id)`: remove from store
   - `getStats()`: total docs, vocabulary size, index size

3. Create `src/rag/RAGManager.ts`:
   - `indexMessage(message)`: index a conversation message
   - `indexCode(filePath, content)`: index code file
   - `searchContext(query, maxTokens)`: search and return context that fits token budget
   - `buildAugmentedPrompt(query, basePrompt)`: inject relevant context into prompt
   - Auto-index messages as they come in (hook into streaming)

4. Integrate with agent streaming:
   - In `services/promptUtils.ts` `buildContextInjection()`: before building context, search RAG for relevant prior context
   - Add RAG context as "Relevant History" section in system prompt
   - Limit RAG injection to ~20% of context window

5. Create `components/RAGPanel.tsx`:
   - Shows indexed document count, vocabulary size
   - Search bar to test semantic search
   - Recent indexed documents list
   - Add "RAG" tab to RightPanel

## UI Style
- Match existing dark theme
- Simple stats cards
- Search results with similarity score badges
