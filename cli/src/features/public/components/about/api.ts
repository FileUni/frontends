import type { AboutUpdateInfo } from '@fileuni/shared';
import { client, extractData } from '@/lib/api';

interface RuntimeVersionPayload {
  version: string;
}

export const fetchRuntimeVersionApi = async (): Promise<RuntimeVersionPayload> => {
  return extractData<RuntimeVersionPayload>(client.GET('/api/v1/system/version'));
};

export const checkLatestReleaseApi = async (): Promise<AboutUpdateInfo> => {
  return extractData<AboutUpdateInfo>(client.GET('/api/v1/admin/about/latest-release'));
};
