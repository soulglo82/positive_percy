const API_BASE = '/api';

class Entity {
  constructor(endpoint) {
    this.endpoint = endpoint;
  }

  async list(sortField, limit) {
    const params = new URLSearchParams();
    if (sortField) params.set('sort', sortField);
    if (limit) params.set('limit', limit);
    const qs = params.toString();
    const res = await fetch(`${API_BASE}/${this.endpoint}${qs ? '?' + qs : ''}`);
    if (!res.ok) throw new Error(`Failed to list ${this.endpoint}`);
    return res.json();
  }

  async filter(filterObj, sortField) {
    const res = await fetch(`${API_BASE}/${this.endpoint}/filter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filter: filterObj, sort: sortField }),
    });
    if (!res.ok) throw new Error(`Failed to filter ${this.endpoint}`);
    return res.json();
  }

  async create(data) {
    const res = await fetch(`${API_BASE}/${this.endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Failed to create ${this.endpoint}`);
    return res.json();
  }

  async update(id, data) {
    const res = await fetch(`${API_BASE}/${this.endpoint}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Failed to update ${this.endpoint}`);
    return res.json();
  }

  async delete(id) {
    const res = await fetch(`${API_BASE}/${this.endpoint}/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error(`Failed to delete ${this.endpoint}`);
    return res.json();
  }
}

export const Child = new Entity('children');
export const Point_Event = new Entity('point_events');
export const Redemption = new Entity('redemptions');
export const Reward = new Entity('rewards');
