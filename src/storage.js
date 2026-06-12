import { initializeApp } from 'firebase/app';
import { getDatabase, ref, get, set, remove } from 'firebase/database';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

function encodeKey(key) {
  return key.replace(/:/g, '_');
}

window.storage = {
  async get(key) {
    const encoded = encodeKey(key);
    const snap = await get(ref(db, `storage/${encoded}`));
    if (!snap.exists()) throw new Error(`Key not found: ${key}`);
    return { key, value: snap.val() };
  },
  async set(key, value) {
    const encoded = encodeKey(key);
    await set(ref(db, `storage/${encoded}`), value);
    return { key, value };
  },
  async delete(key) {
    const encoded = encodeKey(key);
    await remove(ref(db, `storage/${encoded}`));
  },
};
