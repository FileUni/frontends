import { client, extractData } from '@/lib/api.ts';
import type { CmdResult, InstallBody, ServiceStatus, ToolInfo } from './types.ts';

export const fetchToolsApi = async () => extractData<ToolInfo[]>(client.GET('/api/v1/admin/extensions/tools'));

export const fetchServicesApi = async () => extractData<ServiceStatus[]>(client.GET('/api/v1/admin/extensions/services'));

export const fetchLatestToolInfoApi = async (tool: string) =>
  extractData<{ version: string; download_url: string }>(client.GET('/api/v1/admin/extensions/tools/{tool}/latest-info', { params: { path: { tool } } }));

export const installToolApi = async (tool: string, body: InstallBody) =>
  extractData<Record<string, unknown>>(
    client.POST('/api/v1/admin/extensions/tools/{tool}/install', {
      params: { path: { tool } },
      body,
    }),
  );

export const deleteToolApi = async (tool: string) =>
  extractData<Record<string, unknown>>(client.DELETE('/api/v1/admin/extensions/tools/{tool}', { params: { path: { tool } } }));
export const serviceActionApi = async (tool: string, action: 'start' | 'stop' | 'restart') => {
  if (action === 'start') {
    return client.POST('/api/v1/admin/extensions/services/{tool}/start', { params: { path: { tool } } });
  }
  if (action === 'stop') {
    return client.POST('/api/v1/admin/extensions/services/{tool}/stop', { params: { path: { tool } } });
  }
  return client.POST('/api/v1/admin/extensions/services/{tool}/restart', { params: { path: { tool } } });
};

export const runToolCommandApi = async (tool: string, args: string[]) =>
  extractData<CmdResult>(
    client.POST('/api/v1/admin/extensions/tools/{tool}/command', {
      params: { path: { tool } },
      body: { command: tool, args },
    }),
  );

export const resetOpenlistAdminApi = async (data_path: string) =>
  extractData<CmdResult>(client.POST('/api/v1/admin/extensions/special/openlist/reset-admin', { body: { data_path } }));
