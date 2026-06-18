/**
 * Minimal IndexedDB mock for jsdom test environments.
 * Provides in-memory object stores for key-based CRUD.
 */

interface IDBStore {
  [key: string]: unknown;
}

const stores = new Map<string, IDBStore>();

function mockIDBRequest<T>(result: T): IDBRequest<T> {
  const req = {
    result,
    error: null,
    source: null,
    transaction: null,
    readyState: 'done' as IDBRequestReadyState,
    onerror: null,
    onsuccess: null as ((this: IDBRequest<T>, ev: Event) => void) | null,
    onupgradeneeded: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
  };
  queueMicrotask(() => {
    if (req.onsuccess) req.onsuccess.call(req, new Event('success'));
  });
  return req;
}

export function createMockIndexedDB(): IDBFactory {
  return {
    open(_name: string, _version?: number): IDBOpenDBRequest {
      const req = mockIDBRequest({}) as unknown as IDBOpenDBRequest;
      // Return a mock IDBDatabase on success
      const db = {
        name: _name,
        version: _version ?? 1,
        objectStoreNames: { contains: (n: string) => stores.has(n) },
        transaction(
          _storeNames: string | string[],
          _mode?: IDBTransactionMode,
        ): IDBTransaction {
          const names = Array.isArray(_storeNames) ? _storeNames : [_storeNames];
          const store: IDBObjectStore = {
            name: names[0],
            keyPath: null,
            indexNames: [] as DOMStringList,
            transaction: {} as IDBTransaction,
            autoIncrement: false,
            put(value: unknown, key?: IDBValidKey): IDBRequest<IDBValidKey> {
              if (key !== undefined) stores.set(names[0], { ...stores.get(names[0]), [String(key)]: value });
              else stores.set(names[0], { ...stores.get(names[0]), [`_auto_${Date.now()}`]: value });
              return mockIDBRequest(key ?? 'ok');
            },
            get(key: IDBValidKey): IDBRequest<unknown> {
              const storeData = stores.get(names[0]) ?? {};
              return mockIDBRequest((storeData as Record<string, unknown>)[String(key)] ?? null);
            },
            delete(key: IDBValidKey): IDBRequest<undefined> {
              const storeData = stores.get(names[0]);
              if (storeData) {
                delete (storeData as Record<string, unknown>)[String(key)];
              }
              return mockIDBRequest(undefined);
            },
            clear(): IDBRequest<undefined> {
              stores.set(names[0], {});
              return mockIDBRequest(undefined);
            },
            count(): IDBRequest<number> {
              const storeData = stores.get(names[0]) ?? {};
              return mockIDBRequest(Object.keys(storeData).length);
            },
            getAll(): IDBRequest<unknown[]> {
              const storeData = stores.get(names[0]) ?? {};
              return mockIDBRequest(Object.values(storeData));
            },
            getAllKeys(): IDBRequest<IDBValidKey[]> {
              const storeData = stores.get(names[0]) ?? {};
              return mockIDBRequest(Object.keys(storeData));
            },
            openCursor(): IDBRequest<IDBCursorWithValue | null> {
              return mockIDBRequest(null);
            },
            createIndex: () => ({} as IDBIndex),
            index: () => ({} as IDBIndex),
            deleteIndex: () => {},
          } as IDBObjectStore;

          return {
            objectStore: (_name: string) => store,
            db,
            error: null,
            mode: _mode ?? 'readonly',
            objectStoreNames: { contains: (n: string) => n === names[0], length: 1, item: () => names[0] } as DOMStringList,
            abort: () => {},
            commit: () => {},
            onabort: null,
            oncomplete: null,
            onerror: null,
          } as IDBTransaction;
        },
        close() {},
        createObjectStore: (_name: string) => ({}) as IDBObjectStore,
        deleteObjectStore: () => {},
        onabort: null,
        onclose: null,
        onerror: null,
        onversionchange: null,
      } as IDBDatabase;

      Object.assign(req, {
        result: db,
        transaction: null as IDBTransaction | null,
      });

      queueMicrotask(() => {
        if (req.onsuccess) req.onsuccess.call(req, new Event('success'));
      });

      return req;
    },
    deleteDatabase(_name: string): IDBOpenDBRequest {
      stores.delete(_name);
      return mockIDBRequest(undefined) as unknown as IDBOpenDBRequest;
    },
    databases(): Promise<IDBDatabaseInfo[]> {
      return Promise.resolve([]);
    },
    cmp(): number {
      return 0;
    },
  };
}
