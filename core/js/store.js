/* DCX Audio - armazenamento local (IndexedDB)
 *
 * RJ.store: get(chave) e put(chave, valor) num banco so por origem.
 * O banco continua "rj2000" para nao perder o que ja esta salvo. Cada pagina e
 * cada aparelho usam um prefixo nas chaves (RJ.prefixedStore, em host.js).
 */
window.RJ = window.RJ || {};

RJ.store = (function () {
  const DB = "rj2000", STORE = "projects";
  function open() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) return reject(new Error("IndexedDB indisponivel"));
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  async function put(key, value) {
    try {
      const db = await open();
      await new Promise((res, rej) => {
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).put(value, key);
        tx.oncomplete = res; tx.onerror = () => rej(tx.error);
      });
      return true;
    } catch (e) { console.warn("Nao foi possivel salvar no navegador", e); return false; }
  }
  async function get(key) {
    try {
      const db = await open();
      return await new Promise((res, rej) => {
        const tx = db.transaction(STORE, "readonly");
        const r = tx.objectStore(STORE).get(key);
        r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
      });
    } catch (e) { return null; }
  }
  return { put, get };
})();
