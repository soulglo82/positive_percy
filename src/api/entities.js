import { getToken } from '@/lib/AuthContext';

const API_BASE = '/api';

function getFamilyCode() {
  return localStorage.getItem('positive_percy_family_code') || '';
}

function authHeaders(extra = {}) {
  const token = getToken();
  const headers = { ...extra };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function parseError(res, fallback) {
  try {
    const body = await res.json();
    return body.error || fallback;
  } catch {
    return fallback;
  }
}

class Entity {
  constructor(endpoint) {
    this.endpoint = endpoint;
  }

  async list(sortField, limit, offset) {
    const params = new URLSearchParams();
    if (sortField) params.set('sort', sortField);
    if (limit) params.set('limit', limit);
    if (offset) params.set('offset', offset);
    const fc = getFamilyCode();
    if (fc) params.set('family_code', fc);
    const qs = params.toString();
    const res = await fetch(`${API_BASE}/${this.endpoint}${qs ? '?' + qs : ''}`, {
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error(await parseError(res, `Failed to list ${this.endpoint}`));
    return res.json();
  }

  async filter(filterObj, sortField) {
    const fc = getFamilyCode();
    const filter = fc ? { ...filterObj, family_code: fc } : filterObj;
    const res = await fetch(`${API_BASE}/${this.endpoint}/filter`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ filter, sort: sortField }),
    });
    if (!res.ok) throw new Error(await parseError(res, `Failed to filter ${this.endpoint}`));
    return res.json();
  }

  async create(data) {
    const fc = getFamilyCode();
    const payload = fc ? { ...data, family_code: fc } : data;
    const res = await fetch(`${API_BASE}/${this.endpoint}`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await parseError(res, `Failed to create ${this.endpoint}`));
    return res.json();
  }

  async update(id, data) {
    const res = await fetch(`${API_BASE}/${this.endpoint}/${id}`, {
      method: 'PUT',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw await entityError(res, `Failed to update ${this.endpoint}`);
    return res.json();
  }

  // `body` (optional): D1 §21.2, the snapshot of savings a parent confirmed.
  async delete(id, body) {
    const res = await fetch(`${API_BASE}/${this.endpoint}/${id}`, {
      method: 'DELETE',
      headers: body ? authHeaders({ 'Content-Type': 'application/json' }) : authHeaders(),
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!res.ok) throw await entityError(res, `Failed to delete ${this.endpoint}`);
    return res.json();
  }
}

// Keeps the status and, for D1 §21's ENDS_SAVINGS, the server's list of what
// would be released and the snapshot to confirm.
async function entityError(res, fallback) {
  const body = await res.clone().json().catch(() => ({}));
  const err = new Error(await parseError(res, fallback));
  err.status = res.status;
  err.code = body?.code;
  if (body?.code === 'ENDS_SAVINGS') { err.ending = body.ending; err.snapshot = body.snapshot; }
  return err;
}

export const Child = new Entity('children');
export const Point_Event = new Entity('point_events');
export const Redemption = new Entity('redemptions');
export const Reward = new Entity('rewards');
export const Family_Goal = new Entity('family_goals');
