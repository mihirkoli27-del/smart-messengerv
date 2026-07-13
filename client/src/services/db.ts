// Native IndexedDB wrapper to securely store the user's private E2EE key locally.
// The private key must never be sent to the server.

const DB_NAME = 'AntigravityChatE2EE';
const DB_VERSION = 1;
const STORE_NAME = 'private_keys';

const openDatabase = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: any) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = (event: any) => {
      resolve(event.target.result);
    };

    request.onerror = (event: any) => {
      reject(event.target.error || new Error('Failed to open database'));
    };
  });
};

export const getPrivateKeyFromDB = async (userId: string): Promise<string | null> => {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(userId);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        reject(request.error || new Error('Failed to read key'));
      };
    });
  } catch (error) {
    console.error('Error fetching private key from IndexedDB:', error);
    return null;
  }
};

export const savePrivateKeyToDB = async (userId: string, privateKeyJwk: string): Promise<void> => {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(privateKeyJwk, userId);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(request.error || new Error('Failed to write key'));
      };
    });
  } catch (error) {
    console.error('Error saving private key to IndexedDB:', error);
  }
};

export const deletePrivateKeyFromDB = async (userId: string): Promise<void> => {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(userId);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(request.error || new Error('Failed to delete key'));
      };
    });
  } catch (error) {
    console.error('Error deleting private key from IndexedDB:', error);
  }
};
