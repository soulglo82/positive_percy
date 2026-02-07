const API_BASE = '/api';

function getFamilyCode() {
  return localStorage.getItem('positive_percy_family_code') || '';
}

class Entity {
  constructor(endpoint) {
    this.endpoint = endpoint;
  }

  async list(sortField, limit) {
    const params = new URLSearchParams();
    if (sortField) params.set('sort', sortField);
    if (limit) params.set('limit', limit);
    const fc = getFamilyCode();
    if (fc) params.set('family_code', fc);
    const qs = params.toString();
    const res = await fetch(`${API_BASE}/${this.endpoint}${qs ? '?' + qs : ''}`);
    if (!res.ok) throw new Error(`Failed to list ${this.endpoint}`);
    return res.json();
  }

  async filter(filterObj, sortField) {
    const fc = getFamilyCode();
    const filter = fc ? { ...filterObj, family_code: fc } : filterObj;
    const res = await fetch(`${API_BASE}/${this.endpoint}/filter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filter, sort: sortField }),
    });
    if (!res.ok) throw new Error(`Failed to filter ${this.endpoint}`);
    return res.json();
  }

  async create(data) {
    const fc = getFamilyCode();
    const payload = fc ? { ...data, family_code: fc } : data;
    const res = await fetch(`${API_BASE}/${this.endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
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
