import { apiFetch } from './client';
import { API_CONFIG } from './config';
import { Equipment } from './types';

export interface EquipmentSearchParams {
  category?: string;
  state?: string;
  district?: string;
  minPrice?: number;
  maxPrice?: number;
  condition?: string;
  page?: number;
  limit?: number;
}

export const equipmentApi = {
  async searchEquipment(params: EquipmentSearchParams = {}): Promise<{ count: number; total: number; data: Equipment[] }> {
    const query = new URLSearchParams();
    if (params.category && params.category !== 'ALL') query.set('category', params.category);
    if (params.state) query.set('state', params.state);
    if (params.district) query.set('district', params.district);
    if (params.minPrice) query.set('minPrice', String(params.minPrice));
    if (params.maxPrice) query.set('maxPrice', String(params.maxPrice));
    if (params.condition) query.set('condition', params.condition);
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));

    const qs = query.toString();
    const url = `${API_CONFIG.equipment.baseUrl}/api/v1/equipment${qs ? `?${qs}` : ''}`;
    const res = await apiFetch<{ success: boolean; count: number; total: number; data: Equipment[] }>(url, {
      method: 'GET',
      skipAuth: true,
    });
    return res;
  },

  async getMyEquipment(): Promise<Equipment[]> {
    const res = await apiFetch<{ success: boolean; count: number; data: Equipment[] }>(
      `${API_CONFIG.equipment.baseUrl}/api/v1/equipment/my-equipment`,
      { method: 'GET' }
    );
    return res.data || [];
  },

  async getEquipmentById(equipmentId: string): Promise<Equipment> {
    const res = await apiFetch<{ success: boolean; data: Equipment }>(
      `${API_CONFIG.equipment.baseUrl}/api/v1/equipment/${encodeURIComponent(equipmentId)}`,
      { method: 'GET', skipAuth: true }
    );
    return res.data;
  },

  async checkAvailability(equipmentId: string, startDate: string, endDate: string): Promise<{ isAvailable: boolean }> {
    const query = new URLSearchParams({ startDate, endDate });
    const res = await apiFetch<{ success: boolean; data: { isAvailable: boolean } }>(
      `${API_CONFIG.equipment.baseUrl}/api/v1/equipment/${encodeURIComponent(equipmentId)}/availability?${query.toString()}`,
      { method: 'GET', skipAuth: true }
    );
    return res.data;
  },

  async createEquipment(payload: Partial<Equipment>, idempotencyKey?: string): Promise<Equipment> {
    const res = await apiFetch<{ success: boolean; data: Equipment }>(
      `${API_CONFIG.equipment.baseUrl}/api/v1/equipment`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
        idempotencyKey,
      }
    );
    return res.data;
  },

  async updateEquipment(equipmentId: string, payload: Partial<Equipment>): Promise<Equipment> {
    const res = await apiFetch<{ success: boolean; data: Equipment }>(
      `${API_CONFIG.equipment.baseUrl}/api/v1/equipment/${encodeURIComponent(equipmentId)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }
    );
    return res.data;
  },

  async deleteEquipment(equipmentId: string): Promise<void> {
    await apiFetch(
      `${API_CONFIG.equipment.baseUrl}/api/v1/equipment/${encodeURIComponent(equipmentId)}`,
      { method: 'DELETE' }
    );
  },
};
