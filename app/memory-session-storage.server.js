/** In-memory Shopify sessions (no DB). Lost on server restart; fine for local UI work. */
export class MemorySessionStorage {
  #sessions = new Map();

  async storeSession(session) {
    this.#sessions.set(session.id, session);
    return true;
  }

  async loadSession(id) {
    return this.#sessions.get(id);
  }

  async deleteSession(id) {
    return this.#sessions.delete(id);
  }

  async deleteSessions(ids) {
    let ok = true;
    for (const id of ids) {
      if (!this.#sessions.delete(id)) ok = false;
    }
    return ok;
  }

  async findSessionsByShop(shop) {
    return [...this.#sessions.values()].filter((s) => s.shop === shop);
  }
}
