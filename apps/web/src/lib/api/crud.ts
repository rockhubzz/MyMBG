import { apiClient } from '@/lib/api/client';
import { EntityDefinition, PagedResult } from '@/types/crud';

export const crudApi = {
  getEntities: () => apiClient<EntityDefinition[]>('/crud/meta/entities'),
  getEntity: (entity: string) => apiClient<EntityDefinition>(`/crud/meta/${entity}`),
  list: (entity: string, page = 1, pageSize = 20, q = '') =>
    apiClient<PagedResult>(`/crud/${entity}?page=${page}&pageSize=${pageSize}&q=${encodeURIComponent(q)}`),
  getById: (entity: string, id: string) => apiClient<Record<string, unknown>>(`/crud/${entity}/${id}`),
  create: (entity: string, payload: Record<string, unknown>) =>
    apiClient<Record<string, unknown>>(`/crud/${entity}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  update: (entity: string, id: string, payload: Record<string, unknown>) =>
    apiClient<Record<string, unknown>>(`/crud/${entity}/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  remove: (entity: string, id: string) =>
    apiClient<{ success: boolean }>(`/crud/${entity}/${id}`, { method: 'DELETE' }),
};
