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
  /** Uma transacao por conexao: a conexao fecha quando a transacao termina (P2-07). */
  async function run(mode, fn) {
    const db = await open();
    try {
      return await new Promise((res, rej) => {
        const tx = db.transaction(STORE, mode);
        let out;
        const r = fn(tx.objectStore(STORE));
        if (r) r.onsuccess = () => { out = r.result; };
        tx.oncomplete = () => res(out);
        tx.onerror = () => rej(tx.error || (r && r.error) || new Error("erro no banco"));
        // cota cheia e outras falhas podem abortar sem onerror: sem isto a promessa nunca termina
        tx.onabort = () => rej(tx.error || new Error("gravacao abortada"));
      });
    } finally { try { db.close(); } catch (e) { /* ja fechado */ } }
  }
  async function put(key, value) {
    try {
      await run("readwrite", st => st.put(value, key));
      return true;
    } catch (e) { console.warn("Nao foi possivel salvar no navegador", e); return false; }
  }
  /** Le a chave; em erro devolve null (igual a "nao existe"). */
  async function get(key) {
    try { return await getStrict(key); } catch (e) { return null; }
  }
  /**
   * Como get, mas separa erro de "nao existe": devolve o valor (undefined se a
   * chave nao existe) e REJEITA se o banco falhar. Para quem nao pode gravar por
   * cima quando a leitura falhou (P0-05).
   */
  async function getStrict(key) {
    return run("readonly", st => st.get(key));
  }
  return { put, get, getStrict };
})();
