class LocalEntity {
  constructor(storageKey) {
    this.storageKey = storageKey;
  }

  _getAll() {
    const data = localStorage.getItem(this.storageKey);
    return data ? JSON.parse(data) : [];
  }

  _saveAll(items) {
    localStorage.setItem(this.storageKey, JSON.stringify(items));
  }

  _sort(items, sortField) {
    if (!sortField) return items;
    const desc = sortField.startsWith('-');
    const field = desc ? sortField.slice(1) : sortField;
    return [...items].sort((a, b) => {
      const aVal = a[field] || '';
      const bVal = b[field] || '';
      if (desc) return bVal > aVal ? 1 : bVal < aVal ? -1 : 0;
      return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
    });
  }

  async list(sortField, limit) {
    let items = this._sort(this._getAll(), sortField);
    if (limit) items = items.slice(0, limit);
    return items;
  }

  async filter(filterObj, sortField) {
    let items = this._getAll().filter(item =>
      Object.entries(filterObj).every(([key, value]) => item[key] === value)
    );
    return this._sort(items, sortField);
  }

  async create(data) {
    const items = this._getAll();
    const newItem = {
      ...data,
      id: crypto.randomUUID(),
      created_date: new Date().toISOString(),
    };
    items.push(newItem);
    this._saveAll(items);
    return newItem;
  }

  async update(id, data) {
    const items = this._getAll();
    const index = items.findIndex(item => item.id === id);
    if (index === -1) throw new Error(`Entity with id ${id} not found`);
    items[index] = { ...items[index], ...data };
    this._saveAll(items);
    return items[index];
  }

  async delete(id) {
    const items = this._getAll().filter(item => item.id !== id);
    this._saveAll(items);
  }
}

export const Child = new LocalEntity('positive_percy_children');
export const Point_Event = new LocalEntity('positive_percy_point_events');
export const Redemption = new LocalEntity('positive_percy_redemptions');
export const Reward = new LocalEntity('positive_percy_rewards');
