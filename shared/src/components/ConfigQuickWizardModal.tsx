import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Cpu, Key, Settings2, Wand2, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { AdminPasswordPanel } from './AdminPasswordPanel';
import { LicenseManagementModal } from './LicenseManagementModal';
import { useResolvedTheme } from '../lib/theme';

type DatabaseType = 'postgres' | 'sqlite';
type FriendlyStep = 'performance' | 'database' | 'cache' | 'advanced' | 'license';
type PerformanceTier = 'extreme-low' | 'low' | 'medium' | 'good';
type LoadProfile = 'light' | 'heavy';
type CaptchaPreheatMode = 'memory' | 'balanced' | 'throughput';

type ConfigObject = Record<string, unknown>;

interface FriendlyDraft {
  performanceTier: PerformanceTier;
  loadProfile: LoadProfile;
  captchaPreheatMode: CaptchaPreheatMode;
  databaseType: DatabaseType;
  postgresDsn: string;
  sqliteDsn: string;
  dbHost: string;
  dbPort: string;
  dbUser: string;
  dbPass: string;
  dbName: string;
  sqlitePath: string;
  dbHealthTimeoutSeconds: string;
  cacheType: string;
  cacheRedisUrl: string;
  cacheHost: string;
  cachePort: string;
  cacheUser: string;
  cachePass: string;
  cacheUseTls: boolean;
  enableRegistration: boolean;
  plusEnabled: boolean;
  plusCaptureLogs: boolean;
  captchaCodeLength: string;
  captchaExpiresIn: string;
  allocatorPolicy: 'system' | 'mimalloc' | 'jemalloc';
  allocatorProfile: 'low_memory' | 'balanced' | 'throughput';
}

const defaultDraft: FriendlyDraft = {
  performanceTier: 'good',
  loadProfile: 'heavy',
  captchaPreheatMode: 'balanced',
  databaseType: 'postgres',
  postgresDsn: 'postgres://postgres:admin888@localhost:5432/fileuni',
  sqliteDsn: 'sqlite://{APPDATADIR}/fileuni.db',
  dbHost: 'localhost',
  dbPort: '5432',
  dbUser: 'postgres',
  dbPass: 'admin888',
  dbName: 'fileuni',
  sqlitePath: '{APPDATADIR}/fileuni.db',
  dbHealthTimeoutSeconds: '5',
  cacheType: 'valkey',
  cacheRedisUrl: 'redis://:admin888@127.0.0.1:6379',
  cacheHost: '127.0.0.1',
  cachePort: '6379',
  cacheUser: '',
  cachePass: 'admin888',
  cacheUseTls: false,
  enableRegistration: false,
  plusEnabled: true,
  plusCaptureLogs: true,
  captchaCodeLength: '6',
  captchaExpiresIn: '300',
  allocatorPolicy: 'mimalloc',
  allocatorProfile: 'balanced',
};

interface PerformancePreset {
  tier: PerformanceTier;
  labelKey: string;
  descKey: string;
  recommendations: {
    databaseType: DatabaseType;
    cacheType: string;
    maxConnections: number;
    cacheMemoryMB: number;
  };
  features: {
    compression: boolean;
    sftp: boolean;
    ftp: boolean;
    webdav: boolean;
    s3: boolean;
    bloomWarmup: boolean;
    chat: boolean;
    email: boolean;
  };
}

interface EffectivePreset {
  preset: PerformancePreset;
  maxConnections: number;
  features: PerformancePreset['features'];
}

interface PerformanceTuningPlan {
  domainRequestTimeoutSec: number;
  domainWebhookTimeoutSec: number;
  domainDnsPropagationWaitSec: number;
  domainChallengePollIntervalSec: number;
  domainChallengeMaxPollCount: number;
  chatRateLimitWindowSecs: number;
  chatRateLimitMessagesPerWindow: number;
  chatWsSessionTimeoutSecs: number;
  chatMaxMessageSizeBytes: number;
  chatMaxGroupsPerUser: number;
  chatMaxMembersPerGroup: number;
  chatMaxGroupsJoinedPerUser: number;
  chatMaxGuestInvitesPerUser: number;
  dbMaxConnections: number;
  dbMaxConnectionsLowMemory: number;
  dbMaxConnectionsThroughput: number;
  dbMinConnections: number;
  sqliteCacheSize: number;
  sqliteMmapSize: number;
  cacheMemoryMB: number;
  kvDefaultTtlSecs: number;
  kvConditionTtlSecs: number;
  kvDashmapUpperLimitRatio: number;
  notifyUnreadCountCacheTtlSecs: number;
  notifyRetentionDays: number;
  systemBackupMaxSizeMb: number;
  middleware: {
    ipWindowSecs: number;
    ipMaxRequests: number;
    clientWindowSecs: number;
    clientMaxRequests: number;
    clientMaxCid: number;
    userWindowSecs: number;
    userMaxRequests: number;
    userMaxId: number;
    bruteForceEnabled: boolean;
    bruteForceMaxFailuresPerUserIp: number;
    bruteForceMaxFailuresPerIpGlobal: number;
    bruteForceLockoutSecs: number;
    bruteForceBackoffEnabled: boolean;
  };
  scheduler: {
    criticalCron: string;
    maintenanceCron: string;
    lowPriorityCron: string;
    healthCheckCron: string;
  };
  bloomWarmupTuning: {
    reserveCapacity: number;
    maxUsersPerRun: number;
    yieldEveryUsers: number;
    sleepMsPerYield: number;
  };
  quotaCalibrationTuning: {
    maxUsersPerRun: number;
    yieldEveryUsers: number;
    sleepMsPerUser: number;
  };
  fileIndexSyncTuning: {
    maxUsersPerRun: number;
    yieldEveryUsers: number;
    sleepMsPerUser: number;
  };
  captchaPreheat: {
    graphicCacheSize: number;
    graphicGenConcurrency: number;
    maxGenConcurrency: number;
    poolCheckIntervalSecs: number;
    emergencyFillMultiplier: number;
  };
  vfsBatchMaxConcurrentTasks: number;
  vfsBatchMaxConcurrentTasksLowMemory: number;
  vfsBatchMaxConcurrentTasksThroughput: number;
  fileIndexMaxConcurrentRefresh: number;
  fileIndexMaxConcurrentRefreshLowMemory: number;
  fileIndexMaxConcurrentRefreshThroughput: number;
  compressionConcurrency: number;
  compressionConcurrencyLowMemory: number;
  compressionConcurrencyThroughput: number;
  compressionMaxCpuThreads: number;
  compressionMaxCpuThreadsLowMemory: number;
  compressionMaxCpuThreadsThroughput: number;
  taskRetentionDays: number;
  journalLogRetentionDays: number;
  journalLogBatchSize: number;
  journalLogBatchSizeLowMemory: number;
  journalLogBatchSizeThroughput: number;
  journalLogFlushIntervalMs: number;
  journalLogQueueCapacityMultiplier: number;
  webApiUploadMaxFileSize: number;
  webRefreshIntervalSec: number;
  logEnableAsync: boolean;
}

interface ConfigPreviewItem {
  path: string;
  value: string;
}

interface ConfigPreviewGroupStat {
  key: string;
  labelKey: string;
  count: number;
}

const PERFORMANCE_PRESETS: PerformancePreset[] = [
  {
    tier: 'extreme-low',
    labelKey: 'admin.config.quickWizard.performance.tiers.extremeLow',
    descKey: 'admin.config.quickWizard.performance.descriptions.extremeLow',
    recommendations: {
      databaseType: 'sqlite',
      cacheType: 'database',
      maxConnections: 2,
      cacheMemoryMB: 4,
    },
    features: {
      compression: false,
      sftp: false,
      ftp: false,
      webdav: true,
      s3: false,
      bloomWarmup: false,
      chat: false,
      email: false,
    },
  },
  {
    tier: 'low',
    labelKey: 'admin.config.quickWizard.performance.tiers.low',
    descKey: 'admin.config.quickWizard.performance.descriptions.low',
    recommendations: {
      databaseType: 'sqlite',
      cacheType: 'database',
      maxConnections: 5,
      cacheMemoryMB: 16,
    },
    features: {
      compression: false,
      sftp: false,
      ftp: false,
      webdav: true,
      s3: false,
      bloomWarmup: false,
      chat: false,
      email: false,
    },
  },
  {
    tier: 'medium',
    labelKey: 'admin.config.quickWizard.performance.tiers.medium',
    descKey: 'admin.config.quickWizard.performance.descriptions.medium',
    recommendations: {
      databaseType: 'sqlite',
      cacheType: 'database',
      maxConnections: 20,
      cacheMemoryMB: 32,
    },
    features: {
      compression: false,
      sftp: false,
      ftp: false,
      webdav: true,
      s3: false,
      bloomWarmup: true,
      chat: false,
      email: false,
    },
  },
  {
    tier: 'good',
    labelKey: 'admin.config.quickWizard.performance.tiers.good',
    descKey: 'admin.config.quickWizard.performance.descriptions.good',
    recommendations: {
      databaseType: 'postgres',
      cacheType: 'valkey',
      maxConnections: 100,
      cacheMemoryMB: 256,
    },
    features: {
      compression: true,
      sftp: true,
      ftp: true,
      webdav: true,
      s3: true,
      bloomWarmup: true,
      chat: true,
      email: true,
    },
  },
];

const LOAD_PROFILE_PRESETS = {
  medium: {
    light: {
      maxConnections: 20,
      features: {
        compression: false,
        sftp: false,
        ftp: true,
        webdav: true,
        s3: false,
        bloomWarmup: true,
        chat: true,
        email: false,
      },
    },
    heavy: {
      maxConnections: 30,
      features: {
        compression: false,
        sftp: false,
        ftp: false,
        webdav: true,
        s3: false,
        bloomWarmup: false,
        chat: false,
        email: false,
      },
    },
  },
  good: {
    light: {
      maxConnections: 50,
      features: {
        compression: true,
        sftp: true,
        ftp: true,
        webdav: true,
        s3: true,
        bloomWarmup: true,
        chat: true,
        email: true,
      },
    },
    heavy: {
      maxConnections: 200,
      features: {
        compression: false,
        sftp: true,
        ftp: false,
        webdav: true,
        s3: true,
        bloomWarmup: false,
        chat: false,
        email: false,
      },
    },
  },
};

const CRITICAL_TASK_KEYS = ['process_timeout_check', 'interrupted_task_checker'] as const;
const MAINTENANCE_TASK_KEYS = [
  'cache_ttl_cleanup',
  'temp_cleanup',
  'quota_calibration',
  'file_index_sync',
  'audit_log_pruning',
  's3_multipart_cleanup',
  'trash_cleanup',
] as const;
const LOW_PRIORITY_TASK_KEYS = [
  'share_cleanup',
  'domain_ddns_sync_check',
  'domain_acme_renewal_check',
  'notification_cleanup',
  'task_cleanup',
  'system_backup',
] as const;

const everyMinutesCron = (minutes: number): string => {
  return `0 */${Math.max(1, minutes)} * * * *`;
};

const resolveEffectivePreset = (draft: FriendlyDraft, preset: PerformancePreset): EffectivePreset => {
  const tierKey = draft.performanceTier === 'medium' ? 'medium' : draft.performanceTier === 'good' ? 'good' : null;
  const hasLoadProfile = tierKey && LOAD_PROFILE_PRESETS[tierKey as keyof typeof LOAD_PROFILE_PRESETS] && draft.loadProfile;
  if (hasLoadProfile) {
    const profile = LOAD_PROFILE_PRESETS[tierKey as keyof typeof LOAD_PROFILE_PRESETS][draft.loadProfile as 'light' | 'heavy'];
    return {
      preset,
      maxConnections: profile.maxConnections,
      features: profile.features,
    };
  }
  return {
    preset,
    maxConnections: preset.recommendations.maxConnections,
    features: preset.features,
  };
};

const buildPerformanceTuningPlan = (draft: FriendlyDraft, effectivePreset: EffectivePreset): PerformanceTuningPlan => {
  const { preset, maxConnections } = effectivePreset;
  const isHeavyProfile = draft.loadProfile === 'heavy';
  let cacheMemoryMB = preset.recommendations.cacheMemoryMB;
  if ((preset.tier === 'medium' || preset.tier === 'good') && isHeavyProfile) {
    cacheMemoryMB = Math.round(cacheMemoryMB * 1.5);
  }

  const dbMinConnections = draft.databaseType === 'postgres'
    ? Math.max(1, Math.floor(maxConnections * 0.1))
    : 1;
  const dbMaxConnectionsLowMemory = Math.max(1, Math.floor(maxConnections * 0.5));
  const dbMaxConnectionsThroughput = Math.max(maxConnections, Math.ceil(maxConnections * 1.5));

  const sqliteCacheSize = preset.tier === 'extreme-low'
    ? 256
    : preset.tier === 'low'
      ? 512
      : preset.tier === 'medium'
        ? 2048
        : 4096;
  const sqliteMmapSize = preset.tier === 'good' ? 268435456 : 33554432;
  const kvTtlByTier: Record<PerformanceTier, { defaultTtl: number; conditionTtl: number; dashmapUpperLimitRatio: number }> = {
    'extreme-low': { defaultTtl: 900, conditionTtl: 60, dashmapUpperLimitRatio: 0.6 },
    low: { defaultTtl: 1200, conditionTtl: 90, dashmapUpperLimitRatio: 0.7 },
    medium: { defaultTtl: isHeavyProfile ? 2400 : 1800, conditionTtl: isHeavyProfile ? 180 : 120, dashmapUpperLimitRatio: isHeavyProfile ? 0.95 : 0.85 },
    good: { defaultTtl: isHeavyProfile ? 7200 : 3600, conditionTtl: isHeavyProfile ? 600 : 300, dashmapUpperLimitRatio: isHeavyProfile ? 1.3 : 1.1 },
  };
  const notifyByTier: Record<PerformanceTier, { unreadCountCacheTtl: number; retentionDays: number }> = {
    'extreme-low': { unreadCountCacheTtl: 300, retentionDays: 30 },
    low: { unreadCountCacheTtl: 600, retentionDays: 45 },
    medium: { unreadCountCacheTtl: isHeavyProfile ? 1800 : 1200, retentionDays: isHeavyProfile ? 60 : 90 },
    good: { unreadCountCacheTtl: isHeavyProfile ? 3600 : 2400, retentionDays: isHeavyProfile ? 120 : 90 },
  };
  const systemBackupByTier: Record<PerformanceTier, { maxBackupSizeMb: number }> = {
    'extreme-low': { maxBackupSizeMb: 256 },
    low: { maxBackupSizeMb: 512 },
    medium: { maxBackupSizeMb: isHeavyProfile ? 2048 : 1024 },
    good: { maxBackupSizeMb: isHeavyProfile ? 8192 : 4096 },
  };

  const middlewareByTier: Record<PerformanceTier, PerformanceTuningPlan['middleware']> = {
    'extreme-low': {
      ipWindowSecs: 60,
      ipMaxRequests: 60,
      clientWindowSecs: 60,
      clientMaxRequests: 80,
      clientMaxCid: 80,
      userWindowSecs: 60,
      userMaxRequests: 120,
      userMaxId: 50,
      bruteForceEnabled: true,
      bruteForceMaxFailuresPerUserIp: 3,
      bruteForceMaxFailuresPerIpGlobal: 10,
      bruteForceLockoutSecs: 600,
      bruteForceBackoffEnabled: true,
    },
    low: {
      ipWindowSecs: 60,
      ipMaxRequests: 90,
      clientWindowSecs: 60,
      clientMaxRequests: 120,
      clientMaxCid: 150,
      userWindowSecs: 60,
      userMaxRequests: 160,
      userMaxId: 80,
      bruteForceEnabled: true,
      bruteForceMaxFailuresPerUserIp: 4,
      bruteForceMaxFailuresPerIpGlobal: 15,
      bruteForceLockoutSecs: 480,
      bruteForceBackoffEnabled: true,
    },
    medium: {
      ipWindowSecs: 60,
      ipMaxRequests: isHeavyProfile ? 220 : 180,
      clientWindowSecs: 60,
      clientMaxRequests: isHeavyProfile ? 260 : 220,
      clientMaxCid: isHeavyProfile ? 1000 : 700,
      userWindowSecs: 60,
      userMaxRequests: isHeavyProfile ? 320 : 260,
      userMaxId: isHeavyProfile ? 500 : 300,
      bruteForceEnabled: true,
      bruteForceMaxFailuresPerUserIp: isHeavyProfile ? 6 : 5,
      bruteForceMaxFailuresPerIpGlobal: isHeavyProfile ? 24 : 20,
      bruteForceLockoutSecs: isHeavyProfile ? 300 : 360,
      bruteForceBackoffEnabled: true,
    },
    good: {
      ipWindowSecs: 60,
      ipMaxRequests: isHeavyProfile ? 500 : 300,
      clientWindowSecs: 60,
      clientMaxRequests: isHeavyProfile ? 600 : 360,
      clientMaxCid: isHeavyProfile ? 5000 : 2500,
      userWindowSecs: 60,
      userMaxRequests: isHeavyProfile ? 700 : 420,
      userMaxId: isHeavyProfile ? 3000 : 1200,
      bruteForceEnabled: true,
      bruteForceMaxFailuresPerUserIp: isHeavyProfile ? 8 : 6,
      bruteForceMaxFailuresPerIpGlobal: isHeavyProfile ? 30 : 24,
      bruteForceLockoutSecs: isHeavyProfile ? 180 : 240,
      bruteForceBackoffEnabled: true,
    },
  };

  const schedulerByTier: Record<PerformanceTier, PerformanceTuningPlan['scheduler']> = {
    'extreme-low': {
      criticalCron: everyMinutesCron(10),
      maintenanceCron: everyMinutesCron(30),
      lowPriorityCron: everyMinutesCron(60),
      healthCheckCron: everyMinutesCron(15),
    },
    low: {
      criticalCron: everyMinutesCron(5),
      maintenanceCron: everyMinutesCron(20),
      lowPriorityCron: everyMinutesCron(40),
      healthCheckCron: everyMinutesCron(10),
    },
    medium: {
      criticalCron: everyMinutesCron(2),
      maintenanceCron: everyMinutesCron(isHeavyProfile ? 12 : 8),
      lowPriorityCron: everyMinutesCron(isHeavyProfile ? 30 : 20),
      healthCheckCron: everyMinutesCron(isHeavyProfile ? 5 : 3),
    },
    good: {
      criticalCron: everyMinutesCron(1),
      maintenanceCron: everyMinutesCron(isHeavyProfile ? 10 : 6),
      lowPriorityCron: everyMinutesCron(isHeavyProfile ? 20 : 15),
      healthCheckCron: everyMinutesCron(isHeavyProfile ? 3 : 2),
    },
  };
  const bloomWarmupTuningByTier: Record<PerformanceTier, PerformanceTuningPlan['bloomWarmupTuning']> = {
    'extreme-low': {
      reserveCapacity: 100000,
      maxUsersPerRun: 5000,
      yieldEveryUsers: 20,
      sleepMsPerYield: 8,
    },
    low: {
      reserveCapacity: 200000,
      maxUsersPerRun: 20000,
      yieldEveryUsers: 40,
      sleepMsPerYield: 5,
    },
    medium: {
      reserveCapacity: isHeavyProfile ? 300000 : 500000,
      maxUsersPerRun: isHeavyProfile ? 40000 : 60000,
      yieldEveryUsers: isHeavyProfile ? 80 : 100,
      sleepMsPerYield: isHeavyProfile ? 3 : 2,
    },
    good: {
      reserveCapacity: isHeavyProfile ? 600000 : 1000000,
      maxUsersPerRun: isHeavyProfile ? 80000 : 120000,
      yieldEveryUsers: isHeavyProfile ? 120 : 150,
      sleepMsPerYield: isHeavyProfile ? 1 : 0,
    },
  };
  const quotaCalibrationTuningByTier: Record<PerformanceTier, PerformanceTuningPlan['quotaCalibrationTuning']> = {
    'extreme-low': {
      maxUsersPerRun: 200,
      yieldEveryUsers: 20,
      sleepMsPerUser: 20,
    },
    low: {
      maxUsersPerRun: 1000,
      yieldEveryUsers: 40,
      sleepMsPerUser: 10,
    },
    medium: {
      maxUsersPerRun: isHeavyProfile ? 2500 : 4000,
      yieldEveryUsers: isHeavyProfile ? 60 : 80,
      sleepMsPerUser: isHeavyProfile ? 6 : 4,
    },
    good: {
      maxUsersPerRun: isHeavyProfile ? 5000 : 8000,
      yieldEveryUsers: isHeavyProfile ? 100 : 120,
      sleepMsPerUser: isHeavyProfile ? 2 : 1,
    },
  };
  const fileIndexSyncTuningByTier: Record<PerformanceTier, PerformanceTuningPlan['fileIndexSyncTuning']> = {
    'extreme-low': {
      maxUsersPerRun: 50,
      yieldEveryUsers: 10,
      sleepMsPerUser: 80,
    },
    low: {
      maxUsersPerRun: 300,
      yieldEveryUsers: 20,
      sleepMsPerUser: 50,
    },
    medium: {
      maxUsersPerRun: isHeavyProfile ? 600 : 1000,
      yieldEveryUsers: isHeavyProfile ? 30 : 40,
      sleepMsPerUser: isHeavyProfile ? 30 : 20,
    },
    good: {
      maxUsersPerRun: isHeavyProfile ? 1500 : 3000,
      yieldEveryUsers: isHeavyProfile ? 60 : 80,
      sleepMsPerUser: isHeavyProfile ? 10 : 5,
    },
  };
  const captchaPreheatByTier: Record<PerformanceTier, PerformanceTuningPlan['captchaPreheat']> = {
    'extreme-low': {
      graphicCacheSize: 20,
      graphicGenConcurrency: 1,
      maxGenConcurrency: 1,
      poolCheckIntervalSecs: 5,
      emergencyFillMultiplier: 1,
    },
    low: {
      graphicCacheSize: 50,
      graphicGenConcurrency: 2,
      maxGenConcurrency: 2,
      poolCheckIntervalSecs: 3,
      emergencyFillMultiplier: 2,
    },
    medium: {
      graphicCacheSize: isHeavyProfile ? 120 : 80,
      graphicGenConcurrency: 2,
      maxGenConcurrency: 3,
      poolCheckIntervalSecs: 2,
      emergencyFillMultiplier: 2,
    },
    good: {
      graphicCacheSize: isHeavyProfile ? 300 : 180,
      graphicGenConcurrency: isHeavyProfile ? 4 : 3,
      maxGenConcurrency: isHeavyProfile ? 8 : 6,
      poolCheckIntervalSecs: 1,
      emergencyFillMultiplier: isHeavyProfile ? 3 : 2,
    },
  };
  const baseCaptchaPreheat = captchaPreheatByTier[preset.tier];
  const captchaPreheat = (() => {
    if (draft.captchaPreheatMode === 'memory') {
      return {
        graphicCacheSize: Math.max(20, Math.floor(baseCaptchaPreheat.graphicCacheSize * 0.6)),
        graphicGenConcurrency: Math.max(1, baseCaptchaPreheat.graphicGenConcurrency - 1),
        maxGenConcurrency: Math.max(1, baseCaptchaPreheat.maxGenConcurrency - 1),
        poolCheckIntervalSecs: Math.max(1, baseCaptchaPreheat.poolCheckIntervalSecs + 1),
        emergencyFillMultiplier: Math.max(1, baseCaptchaPreheat.emergencyFillMultiplier - 1),
      };
    }
    if (draft.captchaPreheatMode === 'throughput') {
      return {
        graphicCacheSize: Math.max(20, Math.floor(baseCaptchaPreheat.graphicCacheSize * 1.4)),
        graphicGenConcurrency: Math.max(1, baseCaptchaPreheat.graphicGenConcurrency + 1),
        maxGenConcurrency: Math.max(1, baseCaptchaPreheat.maxGenConcurrency + 2),
        poolCheckIntervalSecs: Math.max(1, baseCaptchaPreheat.poolCheckIntervalSecs - 1),
        emergencyFillMultiplier: Math.max(1, baseCaptchaPreheat.emergencyFillMultiplier + 1),
      };
    }
    return baseCaptchaPreheat;
  })();

  const compressionConcurrency = effectivePreset.features.compression
    ? (preset.tier === 'good' ? (isHeavyProfile ? 2 : 4) : preset.tier === 'medium' ? 2 : 1)
    : 1;
  const compressionConcurrencyLowMemory = 1;
  const compressionConcurrencyThroughput = effectivePreset.features.compression
    ? (preset.tier === 'good' ? (isHeavyProfile ? 4 : 6) : preset.tier === 'medium' ? 3 : 2)
    : 1;
  const compressionMaxCpuThreads = effectivePreset.features.compression
    ? (preset.tier === 'good' ? (isHeavyProfile ? 4 : 3) : preset.tier === 'medium' ? 2 : 1)
    : 1;
  const compressionMaxCpuThreadsLowMemory = 1;
  const compressionMaxCpuThreadsThroughput = effectivePreset.features.compression
    ? (preset.tier === 'good' ? (isHeavyProfile ? 8 : 6) : preset.tier === 'medium' ? 4 : 2)
    : 1;
  const vfsBatchMaxConcurrentTasks = effectivePreset.features.compression
    ? (preset.tier === 'good' ? (isHeavyProfile ? 4 : 6) : preset.tier === 'medium' ? 3 : 2)
    : 1;
  const vfsBatchMaxConcurrentTasksLowMemory = 1;
  const vfsBatchMaxConcurrentTasksThroughput = preset.tier === 'good'
    ? (isHeavyProfile ? 6 : 8)
    : preset.tier === 'medium'
      ? 4
      : 2;
  const fileIndexMaxConcurrentRefresh = preset.tier === 'good'
    ? (isHeavyProfile ? 6 : 5)
    : preset.tier === 'medium'
      ? 3
      : 2;
  const fileIndexMaxConcurrentRefreshLowMemory = 1;
  const fileIndexMaxConcurrentRefreshThroughput = preset.tier === 'good'
    ? (isHeavyProfile ? 10 : 8)
    : preset.tier === 'medium'
      ? 5
      : 3;

  const domainRequestTimeoutSec = preset.tier === 'good' ? (isHeavyProfile ? 8 : 12) : preset.tier === 'medium' ? 15 : 20;
  const domainWebhookTimeoutSec = preset.tier === 'good' ? (isHeavyProfile ? 8 : 10) : preset.tier === 'medium' ? 12 : 15;
  const domainDnsPropagationWaitSec = preset.tier === 'good' ? (isHeavyProfile ? 15 : 20) : preset.tier === 'medium' ? 25 : 30;
  const domainChallengePollIntervalSec = preset.tier === 'good' ? 2 : 3;
  const domainChallengeMaxPollCount = preset.tier === 'good' ? (isHeavyProfile ? 120 : 90) : preset.tier === 'medium' ? 75 : 60;
  const chatRateLimitWindowSecs = preset.tier === 'good' ? 10 : 15;
  const chatRateLimitMessagesPerWindow = preset.tier === 'good' ? (isHeavyProfile ? 80 : 50) : preset.tier === 'medium' ? 40 : 20;
  const chatWsSessionTimeoutSecs = preset.tier === 'good' ? 86400 : 43200;
  const chatMaxMessageSizeBytes = preset.tier === 'good' ? (isHeavyProfile ? 131072 : 65536) : preset.tier === 'medium' ? 32768 : 16384;
  const chatMaxGroupsPerUser = preset.tier === 'good' ? 30 : preset.tier === 'medium' ? 20 : 10;
  const chatMaxMembersPerGroup = preset.tier === 'good' ? (isHeavyProfile ? 20000 : 10000) : preset.tier === 'medium' ? 5000 : 1000;
  const chatMaxGroupsJoinedPerUser = preset.tier === 'good' ? (isHeavyProfile ? 400 : 200) : preset.tier === 'medium' ? 150 : 80;
  const chatMaxGuestInvitesPerUser = preset.tier === 'good' ? (isHeavyProfile ? 100 : 50) : preset.tier === 'medium' ? 30 : 10;

  return {
    domainRequestTimeoutSec,
    domainWebhookTimeoutSec,
    domainDnsPropagationWaitSec,
    domainChallengePollIntervalSec,
    domainChallengeMaxPollCount,
    chatRateLimitWindowSecs,
    chatRateLimitMessagesPerWindow,
    chatWsSessionTimeoutSecs,
    chatMaxMessageSizeBytes,
    chatMaxGroupsPerUser,
    chatMaxMembersPerGroup,
    chatMaxGroupsJoinedPerUser,
    chatMaxGuestInvitesPerUser,
    dbMaxConnections: maxConnections,
    dbMaxConnectionsLowMemory,
    dbMaxConnectionsThroughput,
    dbMinConnections,
    sqliteCacheSize,
    sqliteMmapSize,
    cacheMemoryMB,
    kvDefaultTtlSecs: kvTtlByTier[preset.tier].defaultTtl,
    kvConditionTtlSecs: kvTtlByTier[preset.tier].conditionTtl,
    kvDashmapUpperLimitRatio: kvTtlByTier[preset.tier].dashmapUpperLimitRatio,
    notifyUnreadCountCacheTtlSecs: notifyByTier[preset.tier].unreadCountCacheTtl,
    notifyRetentionDays: notifyByTier[preset.tier].retentionDays,
    systemBackupMaxSizeMb: systemBackupByTier[preset.tier].maxBackupSizeMb,
    middleware: middlewareByTier[preset.tier],
    scheduler: schedulerByTier[preset.tier],
    bloomWarmupTuning: bloomWarmupTuningByTier[preset.tier],
    quotaCalibrationTuning: quotaCalibrationTuningByTier[preset.tier],
    fileIndexSyncTuning: fileIndexSyncTuningByTier[preset.tier],
    captchaPreheat,
    vfsBatchMaxConcurrentTasks,
    vfsBatchMaxConcurrentTasksLowMemory,
    vfsBatchMaxConcurrentTasksThroughput,
    fileIndexMaxConcurrentRefresh,
    fileIndexMaxConcurrentRefreshLowMemory,
    fileIndexMaxConcurrentRefreshThroughput,
    compressionConcurrency,
    compressionConcurrencyLowMemory,
    compressionConcurrencyThroughput,
    compressionMaxCpuThreads,
    compressionMaxCpuThreadsLowMemory,
    compressionMaxCpuThreadsThroughput,
    taskRetentionDays: preset.tier === 'good' ? 90 : preset.tier === 'medium' ? 45 : 30,
    journalLogRetentionDays: preset.tier === 'good' ? 180 : preset.tier === 'medium' ? 90 : 30,
    journalLogBatchSize: preset.tier === 'good'
      ? (isHeavyProfile ? 400 : 200)
      : preset.tier === 'medium'
        ? (isHeavyProfile ? 120 : 80)
        : preset.tier === 'low'
          ? 40
          : 20,
    journalLogBatchSizeLowMemory: preset.tier === 'good'
      ? (isHeavyProfile ? 160 : 120)
      : preset.tier === 'medium'
        ? (isHeavyProfile ? 80 : 60)
        : preset.tier === 'low'
          ? 30
          : 12,
    journalLogBatchSizeThroughput: preset.tier === 'good'
      ? (isHeavyProfile ? 600 : 320)
      : preset.tier === 'medium'
        ? (isHeavyProfile ? 180 : 130)
        : preset.tier === 'low'
          ? 60
          : 30,
    journalLogFlushIntervalMs: preset.tier === 'good'
      ? (isHeavyProfile ? 300 : 500)
      : preset.tier === 'medium'
        ? (isHeavyProfile ? 700 : 900)
        : preset.tier === 'low'
          ? 1200
          : 1800,
    journalLogQueueCapacityMultiplier: preset.tier === 'good' ? 4 : preset.tier === 'medium' ? 3 : 2,
    webApiUploadMaxFileSize: preset.tier === 'good'
      ? 1024 * 1024 * 1024
      : preset.tier === 'medium'
        ? 512 * 1024 * 1024
        : 256 * 1024 * 1024,
    webRefreshIntervalSec: preset.tier === 'extreme-low' ? 300 : preset.tier === 'low' ? 120 : preset.tier === 'medium' ? 60 : 30,
    logEnableAsync: preset.tier === 'good',
  };
};

const isRecord = (value: unknown): value is ConfigObject => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const ensureRecord = (target: ConfigObject, key: string): ConfigObject => {
  const value = target[key];
  if (isRecord(value)) {
    return value;
  }
  const next: ConfigObject = {};
  target[key] = next;
  return next;
};

const deepClone = <T,>(value: T): T => {
  return JSON.parse(JSON.stringify(value)) as T;
};

const toStringValue = (value: unknown, fallback: string): string => {
  return typeof value === 'string' ? value : fallback;
};

const nonEmptyString = (value: string, fallback: string): string => {
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : fallback;
};

const toNumberString = (value: unknown, fallback: string): string => {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : fallback;
};

const toBooleanValue = (value: unknown, fallback: boolean): boolean => {
  return typeof value === 'boolean' ? value : fallback;
};

const parsePostgresDsn = (dsn: string): Pick<FriendlyDraft, 'dbHost' | 'dbPort' | 'dbUser' | 'dbPass' | 'dbName'> => {
  const match = dsn.match(/^postgres:\/\/(?:([^:\/?#@]*)(?::([^@\/?#]*))?@)?([^:\/?#]+)?(?::(\d+))?\/([^?#]+)$/i);
  if (!match) {
    return {
      dbHost: defaultDraft.dbHost,
      dbPort: defaultDraft.dbPort,
      dbUser: defaultDraft.dbUser,
      dbPass: defaultDraft.dbPass,
      dbName: defaultDraft.dbName,
    };
  }
  return {
    dbUser: decodeURIComponent(match[1] || defaultDraft.dbUser),
    dbPass: decodeURIComponent(match[2] || defaultDraft.dbPass),
    dbHost: match[3] || defaultDraft.dbHost,
    dbPort: match[4] || defaultDraft.dbPort,
    dbName: decodeURIComponent(match[5] || defaultDraft.dbName),
  };
};

const buildPostgresDsn = (draft: FriendlyDraft): string => {
  const dbUser = nonEmptyString(draft.dbUser, defaultDraft.dbUser);
  const dbPass = nonEmptyString(draft.dbPass, defaultDraft.dbPass);
  const dbHost = nonEmptyString(draft.dbHost, defaultDraft.dbHost);
  const dbPort = nonEmptyString(draft.dbPort, defaultDraft.dbPort);
  const dbName = nonEmptyString(draft.dbName, defaultDraft.dbName);
  const auth = dbUser || dbPass
    ? `${encodeURIComponent(dbUser)}:${encodeURIComponent(dbPass)}@`
    : '';
  return `postgres://${auth}${dbHost}:${dbPort}/${encodeURIComponent(dbName)}`;
};

const parseSqlitePath = (dsn: string): string => {
  if (dsn.startsWith('sqlite://')) {
    return dsn.slice('sqlite://'.length) || defaultDraft.sqlitePath;
  }
  if (dsn.startsWith('sqlite:')) {
    return dsn.slice('sqlite:'.length) || defaultDraft.sqlitePath;
  }
  return defaultDraft.sqlitePath;
};

const buildSqliteDsn = (path: string): string => {
  const sqlitePath = nonEmptyString(path, defaultDraft.sqlitePath);
  return `sqlite://${sqlitePath}`;
};

const parseRedisUrl = (url: string): Pick<FriendlyDraft, 'cacheHost' | 'cachePort' | 'cacheUser' | 'cachePass' | 'cacheUseTls'> => {
  const match = url.match(/^(rediss?):\/\/(?:([^:\/?#@]*)(?::([^@\/?#]*))?@)?([^:\/?#]+)?(?::(\d+))?/i);
  if (!match) {
    return {
      cacheHost: defaultDraft.cacheHost,
      cachePort: defaultDraft.cachePort,
      cacheUser: defaultDraft.cacheUser,
      cachePass: defaultDraft.cachePass,
      cacheUseTls: defaultDraft.cacheUseTls,
    };
  }
  const scheme = match[1] ?? 'redis';
  return {
    cacheUseTls: scheme.toLowerCase() === 'rediss',
    cacheUser: decodeURIComponent(match[2] || ''),
    cachePass: decodeURIComponent(match[3] || ''),
    cacheHost: match[4] || defaultDraft.cacheHost,
    cachePort: match[5] || defaultDraft.cachePort,
  };
};

const getPresetByTier = (tier: PerformanceTier): PerformancePreset => {
  const matched = PERFORMANCE_PRESETS.find((preset) => preset.tier === tier);
  if (matched) {
    return matched;
  }
  const fallback = PERFORMANCE_PRESETS.at(-1);
  if (fallback) {
    return fallback;
  }
  throw new Error('PERFORMANCE_PRESETS must contain at least one item');
};

const buildRedisUrl = (draft: FriendlyDraft): string => {
  const scheme = draft.cacheUseTls ? 'rediss' : 'redis';
  const cacheHost = nonEmptyString(draft.cacheHost, defaultDraft.cacheHost);
  const cachePort = nonEmptyString(draft.cachePort, defaultDraft.cachePort);
  const cacheUser = draft.cacheUser.trim();
  const cachePass = nonEmptyString(draft.cachePass, defaultDraft.cachePass);
  const userEncoded = encodeURIComponent(cacheUser);
  const passEncoded = encodeURIComponent(cachePass);
  const auth = cacheUser || cachePass
    ? `${userEncoded}:${passEncoded}@`
    : '';
  return `${scheme}://${auth}${cacheHost}:${cachePort}`;
};

const normalizeRuntimeOs = (input?: string): 'linux' | 'windows' | 'macos' | 'freebsd' | 'unknown' => {
  const value = (input ?? '').trim().toLowerCase();
  if (value === 'linux') return 'linux';
  if (value === 'windows' || value === 'win32') return 'windows';
  if (value === 'macos' || value === 'darwin' || value === 'mac') return 'macos';
  if (value === 'freebsd') return 'freebsd';
  return 'unknown';
};

const inferClientRuntimeOs = (): 'linux' | 'windows' | 'macos' | 'freebsd' | 'unknown' => {
  if (typeof navigator === 'undefined') {
    return 'unknown';
  }
  const navWithUAData = navigator as Navigator & { userAgentData?: { platform?: string } };
  const platform = (navWithUAData.userAgentData?.platform ?? navigator.platform ?? navigator.userAgent).toLowerCase();
  if (platform.includes('linux')) return 'linux';
  if (platform.includes('win')) return 'windows';
  if (platform.includes('mac') || platform.includes('darwin')) return 'macos';
  if (platform.includes('freebsd')) return 'freebsd';
  return 'unknown';
};

const recommendedAllocatorPolicyForRuntime = (runtimeOs?: string): FriendlyDraft['allocatorPolicy'] => {
  const normalized = normalizeRuntimeOs(runtimeOs);
  if (normalized === 'linux') {
    return 'jemalloc';
  }
  if (normalized === 'windows' || normalized === 'macos' || normalized === 'freebsd') {
    return 'mimalloc';
  }
  const inferred = inferClientRuntimeOs();
  return inferred === 'linux' ? 'jemalloc' : 'mimalloc';
};

const parseConfig = (
  content: string,
  parseToml: (source: string) => unknown,
): { value: ConfigObject | null; error: string | null } => {
  try {
    const parsed = parseToml(content);
    if (!isRecord(parsed)) {
      return { value: null, error: 'TOML root must be an object' };
    }
    return { value: parsed, error: null };
  } catch (error) {
    return { value: null, error: error instanceof Error ? error.message : String(error) };
  }
};

const buildDraftFromConfig = (config: ConfigObject, fallbackPolicy: FriendlyDraft['allocatorPolicy']): FriendlyDraft => {
  const database = isRecord(config.database) ? config.database : {};
  const postgresConfig = isRecord(database.postgres_config) ? database.postgres_config : {};
  const sqliteConfig = isRecord(database.sqlite_config) ? database.sqlite_config : {};
  const kvHub = isRecord(config.fast_kv_storage_hub) ? config.fast_kv_storage_hub : {};
  const userCenter = isRecord(config.user_center) ? config.user_center : {};
  const extensionManager = isRecord(config.extension_manager) ? config.extension_manager : {};
  const plus = isRecord(extensionManager.plus) ? extensionManager.plus : {};
  const captchaCode = isRecord(config.captcha_code) ? config.captcha_code : {};
  const memoryAllocator = isRecord(config.memory_allocator) ? config.memory_allocator : {};
  const graphicCacheSize = typeof captchaCode.graphic_cache_size === 'number' ? captchaCode.graphic_cache_size : 100;
  const maxGenConcurrency = typeof captchaCode.max_gen_concurrency === 'number' ? captchaCode.max_gen_concurrency : 8;
  const captchaPreheatMode: CaptchaPreheatMode = graphicCacheSize <= 50 && maxGenConcurrency <= 2
    ? 'memory'
    : graphicCacheSize >= 200 || maxGenConcurrency >= 6
      ? 'throughput'
      : 'balanced';

  const databaseTypeRaw = toStringValue(database.db_type, defaultDraft.databaseType);
  const databaseType: DatabaseType = databaseTypeRaw === 'sqlite' ? 'sqlite' : 'postgres';
  const postgresDsn = toStringValue(postgresConfig.database_dsn, defaultDraft.postgresDsn);
  const sqliteDsn = toStringValue(sqliteConfig.database_dsn, defaultDraft.sqliteDsn);
  const dbFields = parsePostgresDsn(postgresDsn);
  const sqlitePath = parseSqlitePath(sqliteDsn);

  const cacheRedisUrl = toStringValue(kvHub.redis_url, defaultDraft.cacheRedisUrl);
  const cacheFields = parseRedisUrl(cacheRedisUrl);

  const allocatorPolicyValue = toStringValue(memoryAllocator.policy, fallbackPolicy).toLowerCase();
  const allocatorPolicy: FriendlyDraft['allocatorPolicy'] = allocatorPolicyValue === 'system'
    ? 'system'
    : allocatorPolicyValue === 'mimalloc'
      ? 'mimalloc'
      : allocatorPolicyValue === 'jemalloc'
        ? 'jemalloc'
        : fallbackPolicy;

  const allocatorProfileValue = toStringValue(memoryAllocator.profile, defaultDraft.allocatorProfile).toLowerCase();
  const allocatorProfile: FriendlyDraft['allocatorProfile'] = allocatorProfileValue === 'low_memory'
    ? 'low_memory'
    : allocatorProfileValue === 'throughput'
      ? 'throughput'
      : 'balanced';

  return {
    performanceTier: defaultDraft.performanceTier,
    loadProfile: defaultDraft.loadProfile,
    databaseType,
    captchaPreheatMode,
    postgresDsn,
    sqliteDsn,
    dbHost: dbFields.dbHost,
    dbPort: dbFields.dbPort,
    dbUser: dbFields.dbUser,
    dbPass: dbFields.dbPass,
    dbName: dbFields.dbName,
    sqlitePath,
    dbHealthTimeoutSeconds: toNumberString(database.health_check_timeout_seconds, defaultDraft.dbHealthTimeoutSeconds),
    cacheType: toStringValue(kvHub.kv_type, defaultDraft.cacheType),
    cacheRedisUrl,
    cacheHost: cacheFields.cacheHost,
    cachePort: cacheFields.cachePort,
    cacheUser: cacheFields.cacheUser,
    cachePass: cacheFields.cachePass,
    cacheUseTls: cacheFields.cacheUseTls,
    enableRegistration: toBooleanValue(userCenter.enable_registration, defaultDraft.enableRegistration),
    plusEnabled: toBooleanValue(plus.enabled, defaultDraft.plusEnabled),
    plusCaptureLogs: toBooleanValue(plus.capture_logs, defaultDraft.plusCaptureLogs),
    captchaCodeLength: toNumberString(captchaCode.code_length, defaultDraft.captchaCodeLength),
    captchaExpiresIn: toNumberString(captchaCode.expires_in, defaultDraft.captchaExpiresIn),
    allocatorPolicy,
    allocatorProfile,
  };
};

const applyDraftToConfig = (base: ConfigObject, draft: FriendlyDraft, recommendedPolicy: FriendlyDraft['allocatorPolicy']): ConfigObject => {
  const next = deepClone(base);
  const database = ensureRecord(next, 'database');
  const postgresConfig = ensureRecord(database, 'postgres_config');
  const sqliteConfig = ensureRecord(database, 'sqlite_config');
  const kvHub = ensureRecord(next, 'fast_kv_storage_hub');
  const userCenter = ensureRecord(next, 'user_center');
  const extensionManager = ensureRecord(next, 'extension_manager');
  const plus = ensureRecord(extensionManager, 'plus');
  const captchaCode = ensureRecord(next, 'captcha_code');
  const memoryAllocator = ensureRecord(next, 'memory_allocator');

  database.db_type = draft.databaseType;
  postgresConfig.database_dsn = nonEmptyString(draft.postgresDsn, defaultDraft.postgresDsn);
  sqliteConfig.database_dsn = nonEmptyString(draft.sqliteDsn, defaultDraft.sqliteDsn);

  const healthTimeout = Number.parseInt(draft.dbHealthTimeoutSeconds, 10);
  database.health_check_timeout_seconds = Number.isFinite(healthTimeout) && healthTimeout > 0
    ? healthTimeout
    : Number.parseInt(defaultDraft.dbHealthTimeoutSeconds, 10);

  kvHub.kv_type = nonEmptyString(draft.cacheType, defaultDraft.cacheType);
  kvHub.redis_url = nonEmptyString(draft.cacheRedisUrl, defaultDraft.cacheRedisUrl);

  userCenter.enable_registration = draft.enableRegistration;
  plus.enabled = draft.plusEnabled;
  plus.capture_logs = draft.plusCaptureLogs;

  const captchaCodeLength = Number.parseInt(draft.captchaCodeLength, 10);
  captchaCode.code_length = Number.isFinite(captchaCodeLength) && captchaCodeLength > 0
    ? captchaCodeLength
    : Number.parseInt(defaultDraft.captchaCodeLength, 10);
  const captchaExpiresIn = Number.parseInt(draft.captchaExpiresIn, 10);
  captchaCode.expires_in = Number.isFinite(captchaExpiresIn) && captchaExpiresIn > 0
    ? captchaExpiresIn
    : Number.parseInt(defaultDraft.captchaExpiresIn, 10);

  memoryAllocator.policy = recommendedPolicy;
  memoryAllocator.profile = draft.allocatorProfile;

  const preset = PERFORMANCE_PRESETS.find(p => p.tier === draft.performanceTier);
  if (preset) {
    const effectivePreset = resolveEffectivePreset(draft, preset);
    const effectiveFeatures = effectivePreset.features;
    const tuningPlan = buildPerformanceTuningPlan(draft, effectivePreset);

    memoryAllocator.policy = recommendedPolicy;
    memoryAllocator.profile = preset.tier === 'extreme-low' || preset.tier === 'low'
      ? 'low_memory'
      : (preset.tier === 'good' && draft.loadProfile === 'heavy')
        ? 'throughput'
        : 'balanced';
    captchaCode.graphic_cache_size = tuningPlan.captchaPreheat.graphicCacheSize;
    captchaCode.graphic_gen_concurrency = tuningPlan.captchaPreheat.graphicGenConcurrency;
    captchaCode.max_gen_concurrency = tuningPlan.captchaPreheat.maxGenConcurrency;
    captchaCode.pool_check_interval_secs = tuningPlan.captchaPreheat.poolCheckIntervalSecs;
    captchaCode.emergency_fill_multiplier = tuningPlan.captchaPreheat.emergencyFillMultiplier;
    plus.startup_parallelism_low_memory = preset.tier === 'extreme-low' || preset.tier === 'low' ? 1 : 2;
    plus.startup_parallelism_throughput = preset.tier === 'good' ? (draft.loadProfile === 'heavy' ? 6 : 4) : 2;

    if (draft.databaseType === 'sqlite') {
      sqliteConfig.max_connections = tuningPlan.dbMaxConnections;
      sqliteConfig.max_connections_low_memory = tuningPlan.dbMaxConnectionsLowMemory;
      sqliteConfig.max_connections_throughput = tuningPlan.dbMaxConnectionsThroughput;
      sqliteConfig.min_connections = tuningPlan.dbMinConnections;
      sqliteConfig.cache_size = tuningPlan.sqliteCacheSize;
      sqliteConfig.temp_store = 2;
      sqliteConfig.mmap_size = tuningPlan.sqliteMmapSize;
    } else {
      postgresConfig.max_connections = tuningPlan.dbMaxConnections;
      postgresConfig.max_connections_low_memory = tuningPlan.dbMaxConnectionsLowMemory;
      postgresConfig.max_connections_throughput = tuningPlan.dbMaxConnectionsThroughput;
      postgresConfig.min_connections = tuningPlan.dbMinConnections;
    }

    const dashmapMemBaseMb = Math.max(4, tuningPlan.cacheMemoryMB);
    const dashmapMemLowMb = Math.max(4, Math.floor(dashmapMemBaseMb * 0.5));
    const dashmapMemThroughputMb = Math.max(dashmapMemBaseMb, Math.floor(dashmapMemBaseMb * 1.5));
    kvHub.dashmap_mem_max_bytes = dashmapMemBaseMb * 1024 * 1024;
    kvHub.dashmap_mem_max_bytes_low_memory = dashmapMemLowMb * 1024 * 1024;
    kvHub.dashmap_mem_max_bytes_throughput = dashmapMemThroughputMb * 1024 * 1024;
    kvHub.dashmap_mem_upper_limit_ratio = tuningPlan.kvDashmapUpperLimitRatio;
    kvHub.default_ttl = tuningPlan.kvDefaultTtlSecs;
    kvHub.condition_ttl = tuningPlan.kvConditionTtlSecs;
    if (!Array.isArray(kvHub.dashmap_indexed_prefixes)) {
      kvHub.dashmap_indexed_prefixes = [];
    }
    if (typeof kvHub.key_prefix !== 'string' || kvHub.key_prefix.trim().length === 0) {
      kvHub.key_prefix = 'fileuni:';
    }

    const internalNotify = ensureRecord(next, 'internal_notify');
    internalNotify.unread_count_cache_ttl = tuningPlan.notifyUnreadCountCacheTtlSecs;
    internalNotify.retention_days = tuningPlan.notifyRetentionDays;

    const systemBackup = ensureRecord(next, 'system_backup');
    systemBackup.max_backup_size_mb = tuningPlan.systemBackupMaxSizeMb;

    const middleware = ensureRecord(next, 'middleware');
    const ipRateLimit = ensureRecord(middleware, 'ip_rate_limit');
    ipRateLimit.window_secs = tuningPlan.middleware.ipWindowSecs;
    ipRateLimit.max_requests = tuningPlan.middleware.ipMaxRequests;

    const clientRateLimit = ensureRecord(middleware, 'client_id_rate_limit');
    clientRateLimit.window_secs = tuningPlan.middleware.clientWindowSecs;
    clientRateLimit.max_requests = tuningPlan.middleware.clientMaxRequests;
    clientRateLimit.max_cid = tuningPlan.middleware.clientMaxCid;
    clientRateLimit.client_id_blacklist_enabled = false;

    const userRateLimit = ensureRecord(middleware, 'user_id_rate_limit');
    userRateLimit.window_secs = tuningPlan.middleware.userWindowSecs;
    userRateLimit.max_requests = tuningPlan.middleware.userMaxRequests;
    userRateLimit.max_userid = tuningPlan.middleware.userMaxId;
    userRateLimit.user_id_blacklist_enabled = false;

    const bruteForce = ensureRecord(middleware, 'brute_force');
    bruteForce.enabled = tuningPlan.middleware.bruteForceEnabled;
    bruteForce.max_failures_per_user_ip = tuningPlan.middleware.bruteForceMaxFailuresPerUserIp;
    bruteForce.max_failures_per_ip_global = tuningPlan.middleware.bruteForceMaxFailuresPerIpGlobal;
    bruteForce.lockout_secs = tuningPlan.middleware.bruteForceLockoutSecs;
    bruteForce.enable_exponential_backoff = tuningPlan.middleware.bruteForceBackoffEnabled;

    const vfsHub = ensureRecord(next, 'vfs_storage_hub');
    vfsHub.enable_webdav = effectiveFeatures.webdav;
    vfsHub.enable_sftp = effectiveFeatures.sftp;
    vfsHub.enable_ftp = effectiveFeatures.ftp;
    vfsHub.enable_s3 = effectiveFeatures.s3;

    const fileCompress = ensureRecord(vfsHub, 'file_compress');
    fileCompress.enable = effectiveFeatures.compression;
    fileCompress.process_manager_max_concurrency = tuningPlan.compressionConcurrency;
    fileCompress.process_manager_max_concurrency_low_memory = tuningPlan.compressionConcurrencyLowMemory;
    fileCompress.process_manager_max_concurrency_throughput = tuningPlan.compressionConcurrencyThroughput;
    fileCompress.max_cpu_threads = tuningPlan.compressionMaxCpuThreads;
    fileCompress.max_cpu_threads_low_memory = tuningPlan.compressionMaxCpuThreadsLowMemory;
    fileCompress.max_cpu_threads_throughput = tuningPlan.compressionMaxCpuThreadsThroughput;
    vfsHub.max_concurrent_tasks = tuningPlan.vfsBatchMaxConcurrentTasks;
    const batchOperation = ensureRecord(vfsHub, 'batch_operation');
    batchOperation.max_concurrent_tasks = tuningPlan.vfsBatchMaxConcurrentTasks;
    batchOperation.max_concurrent_tasks_low_memory = tuningPlan.vfsBatchMaxConcurrentTasksLowMemory;
    batchOperation.max_concurrent_tasks_throughput = tuningPlan.vfsBatchMaxConcurrentTasksThroughput;
    const fileIndex = ensureRecord(vfsHub, 'file_index');
    fileIndex.max_concurrent_refresh = tuningPlan.fileIndexMaxConcurrentRefresh;
    fileIndex.max_concurrent_refresh_low_memory = tuningPlan.fileIndexMaxConcurrentRefreshLowMemory;
    fileIndex.max_concurrent_refresh_throughput = tuningPlan.fileIndexMaxConcurrentRefreshThroughput;

    const taskRegistry = ensureRecord(next, 'task_registry');
    const bloomWarmup = ensureRecord(taskRegistry, 'bloom_filter_warmup');
    bloomWarmup.enabled = effectiveFeatures.bloomWarmup;
    bloomWarmup.cron_expression = tuningPlan.scheduler.maintenanceCron;
    const bloomWarmupTuning = ensureRecord(taskRegistry, 'bloom_filter_warmup_tuning');
    bloomWarmupTuning.reserve_capacity = tuningPlan.bloomWarmupTuning.reserveCapacity;
    bloomWarmupTuning.max_users_per_run = tuningPlan.bloomWarmupTuning.maxUsersPerRun;
    bloomWarmupTuning.yield_every_users = tuningPlan.bloomWarmupTuning.yieldEveryUsers;
    bloomWarmupTuning.sleep_ms_per_yield = tuningPlan.bloomWarmupTuning.sleepMsPerYield;
    const quotaCalibrationTuning = ensureRecord(taskRegistry, 'quota_calibration_tuning');
    quotaCalibrationTuning.max_users_per_run = tuningPlan.quotaCalibrationTuning.maxUsersPerRun;
    quotaCalibrationTuning.yield_every_users = tuningPlan.quotaCalibrationTuning.yieldEveryUsers;
    quotaCalibrationTuning.sleep_ms_per_user = tuningPlan.quotaCalibrationTuning.sleepMsPerUser;
    const fileIndexSyncTuning = ensureRecord(taskRegistry, 'file_index_sync_tuning');
    fileIndexSyncTuning.max_users_per_run = tuningPlan.fileIndexSyncTuning.maxUsersPerRun;
    fileIndexSyncTuning.yield_every_users = tuningPlan.fileIndexSyncTuning.yieldEveryUsers;
    fileIndexSyncTuning.sleep_ms_per_user = tuningPlan.fileIndexSyncTuning.sleepMsPerUser;
    taskRegistry.task_retention_days = tuningPlan.taskRetentionDays;

    CRITICAL_TASK_KEYS.forEach((taskName) => {
      const task = ensureRecord(taskRegistry, taskName);
      task.enabled = true;
      task.cron_expression = tuningPlan.scheduler.criticalCron;
    });

    MAINTENANCE_TASK_KEYS.forEach((taskName) => {
      const task = ensureRecord(taskRegistry, taskName);
      task.enabled = true;
      task.cron_expression = tuningPlan.scheduler.maintenanceCron;
    });

    LOW_PRIORITY_TASK_KEYS.forEach((taskName) => {
      const task = ensureRecord(taskRegistry, taskName);
      task.enabled = true;
      task.cron_expression = tuningPlan.scheduler.lowPriorityCron;
    });

    const databaseHealthCheck = ensureRecord(taskRegistry, 'database_health_check');
    databaseHealthCheck.enabled = true;
    databaseHealthCheck.cron_expression = tuningPlan.scheduler.healthCheckCron;

    const sftpServ = ensureRecord(next, 'file_manager_serv_sftp');
    sftpServ.max_connections = effectiveFeatures.sftp ? (preset.tier === 'good' ? 100 : 20) : 1;
    sftpServ.worker_threads = effectiveFeatures.sftp ? (preset.tier === 'good' ? 4 : 2) : 1;

    const ftpServ = ensureRecord(next, 'file_manager_serv_ftp');
    ftpServ.max_connections = effectiveFeatures.ftp ? (preset.tier === 'good' ? 100 : 20) : 1;

    const s3Serv = ensureRecord(next, 'file_manager_serv_s3');
    s3Serv.max_connections = effectiveFeatures.s3 ? (preset.tier === 'good' ? 100 : 20) : 1;

    const chatManager = ensureRecord(next, 'chat_manager');
    chatManager.enabled = effectiveFeatures.chat;
    chatManager.rate_limit_window_secs = tuningPlan.chatRateLimitWindowSecs;
    chatManager.rate_limit_messages_per_window = tuningPlan.chatRateLimitMessagesPerWindow;
    chatManager.ws_session_timeout_secs = tuningPlan.chatWsSessionTimeoutSecs;
    chatManager.max_message_size_bytes = tuningPlan.chatMaxMessageSizeBytes;
    chatManager.max_groups_per_user = tuningPlan.chatMaxGroupsPerUser;
    chatManager.max_members_per_group = tuningPlan.chatMaxMembersPerGroup;
    chatManager.max_groups_joined_per_user = tuningPlan.chatMaxGroupsJoinedPerUser;
    chatManager.max_guest_invites_per_user = tuningPlan.chatMaxGuestInvitesPerUser;

    const domainAcmeDdns = ensureRecord(next, 'domain_acme_ddns');
    domainAcmeDdns.request_timeout_sec = tuningPlan.domainRequestTimeoutSec;
    domainAcmeDdns.webhook_timeout_sec = tuningPlan.domainWebhookTimeoutSec;
    domainAcmeDdns.dns_propagation_wait_sec = tuningPlan.domainDnsPropagationWaitSec;
    domainAcmeDdns.challenge_poll_interval_sec = tuningPlan.domainChallengePollIntervalSec;
    domainAcmeDdns.challenge_max_poll_count = tuningPlan.domainChallengeMaxPollCount;
    const web = ensureRecord(next, 'web');
    web.refresh_interval_sec = tuningPlan.webRefreshIntervalSec;

    const emailManager = ensureRecord(next, 'email_manager');
    emailManager.enabled = effectiveFeatures.email;

    const journalLog = ensureRecord(next, 'journal_log');
    journalLog.log_retention_days = tuningPlan.journalLogRetentionDays;
    journalLog.batch_size = tuningPlan.journalLogBatchSize;
    journalLog.batch_size_low_memory = tuningPlan.journalLogBatchSizeLowMemory;
    journalLog.batch_size_throughput = tuningPlan.journalLogBatchSizeThroughput;
    journalLog.flush_interval_ms = tuningPlan.journalLogFlushIntervalMs;
    journalLog.queue_capacity_multiplier = tuningPlan.journalLogQueueCapacityMultiplier;

    const fileManagerApi = ensureRecord(next, 'file_manager_api');
    fileManagerApi.webapi_upload_max_file_size = tuningPlan.webApiUploadMaxFileSize;

    const logConfig = ensureRecord(next, 'log');
    logConfig.enable_async = tuningPlan.logEnableAsync;
  }

  return next;
};

export interface ConfigQuickWizardModalProps {
  tomlAdapter: {
    parse: (source: string) => unknown;
    stringify: (value: unknown) => string;
  };
  isOpen: boolean;
  onClose: () => void;
  content: string;
  onContentChange: (value: string) => void;
  licenseWizard?: {
    isValid: boolean;
    currentUsers: number;
    maxUsers: number;
    deviceCode: string;
    licenseKey: string;
    saving: boolean;
    onLicenseKeyChange: (value: string) => void;
    onApplyLicense: () => void;
  };
  onResetAdminPassword?: (password: string) => Promise<void | string | { username?: string }>;
  isResettingAdminPassword?: boolean;
  runtimeOs?: string;
}

export const ConfigQuickWizardModal: React.FC<ConfigQuickWizardModalProps> = ({
  tomlAdapter,
  isOpen,
  onClose,
  content,
  onContentChange,
  licenseWizard,
  onResetAdminPassword,
  isResettingAdminPassword = false,
  runtimeOs,
}) => {
  const { t } = useTranslation();
  const [friendlyStep, setFriendlyStep] = useState<FriendlyStep>('performance');
  const [parseError, setParseError] = useState<string | null>(null);
  const [draft, setDraft] = useState<FriendlyDraft>(defaultDraft);
  const [showDetailedPreview, setShowDetailedPreview] = useState(false);
  const [showAdminPasswordPanel, setShowAdminPasswordPanel] = useState(false);
  const [isLicenseModalOpen, setIsLicenseModalOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const resolvedTheme = useResolvedTheme();

  const draftRef = useRef<FriendlyDraft>(defaultDraft);
  const hasInitializedRef = useRef(false);
  const isInternalSyncRef = useRef(false);
  const lastObservedContentRef = useRef(content);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = resolvedTheme === 'dark';

  const friendlySteps = useMemo<FriendlyStep[]>(() => {
    return licenseWizard
      ? ['performance', 'database', 'cache', 'advanced', 'license']
      : ['performance', 'database', 'cache', 'advanced'];
  }, [licenseWizard]);

  const allocatorRecommendation = useMemo(() => {
    const normalized = normalizeRuntimeOs(runtimeOs);
    const effectiveOs = normalized === 'unknown' ? inferClientRuntimeOs() : normalized;
    return {
      os: effectiveOs,
      policy: recommendedAllocatorPolicyForRuntime(runtimeOs),
    };
  }, [runtimeOs]);

  const currentPreset = useMemo(() => {
    const base = getPresetByTier(draft.performanceTier);
    const effectivePreset = resolveEffectivePreset(draft, base);
    return {
      ...base,
      recommendations: {
        ...base.recommendations,
        maxConnections: effectivePreset.maxConnections,
      },
      features: effectivePreset.features,
    };
  }, [draft.performanceTier, draft.loadProfile]);

  const previewTuningPlan = useMemo(() => {
    const base = getPresetByTier(draft.performanceTier);
    const effectivePreset = resolveEffectivePreset(draft, base);
    return buildPerformanceTuningPlan(draft, effectivePreset);
  }, [draft.databaseType, draft.loadProfile, draft.performanceTier, draft.captchaPreheatMode]);

  const previewConfigItems = useMemo<ConfigPreviewItem[]>(() => {
    const items: ConfigPreviewItem[] = [];
    const pushItem = (path: string, value: string | number | boolean) => {
      items.push({ path, value: String(value) });
    };

    pushItem('database.db_type', draft.databaseType);
    if (draft.databaseType === 'sqlite') {
      pushItem('database.sqlite_config.max_connections', previewTuningPlan.dbMaxConnections);
      pushItem('database.sqlite_config.max_connections_low_memory', previewTuningPlan.dbMaxConnectionsLowMemory);
      pushItem('database.sqlite_config.max_connections_throughput', previewTuningPlan.dbMaxConnectionsThroughput);
      pushItem('database.sqlite_config.min_connections', previewTuningPlan.dbMinConnections);
      pushItem('database.sqlite_config.cache_size', previewTuningPlan.sqliteCacheSize);
      pushItem('database.sqlite_config.temp_store', 2);
      pushItem('database.sqlite_config.mmap_size', previewTuningPlan.sqliteMmapSize);
    } else {
      pushItem('database.postgres_config.max_connections', previewTuningPlan.dbMaxConnections);
      pushItem('database.postgres_config.max_connections_low_memory', previewTuningPlan.dbMaxConnectionsLowMemory);
      pushItem('database.postgres_config.max_connections_throughput', previewTuningPlan.dbMaxConnectionsThroughput);
      pushItem('database.postgres_config.min_connections', previewTuningPlan.dbMinConnections);
    }

    pushItem('fast_kv_storage_hub.kv_type', nonEmptyString(draft.cacheType, defaultDraft.cacheType));
    pushItem('fast_kv_storage_hub.default_ttl', previewTuningPlan.kvDefaultTtlSecs);
    pushItem('fast_kv_storage_hub.condition_ttl', previewTuningPlan.kvConditionTtlSecs);
    pushItem('fast_kv_storage_hub.dashmap_mem_upper_limit_ratio', previewTuningPlan.kvDashmapUpperLimitRatio);
    const previewDashmapMemBaseMb = Math.max(4, previewTuningPlan.cacheMemoryMB);
    const previewDashmapMemLowMb = Math.max(4, Math.floor(previewDashmapMemBaseMb * 0.5));
    const previewDashmapMemThroughputMb = Math.max(previewDashmapMemBaseMb, Math.floor(previewDashmapMemBaseMb * 1.5));
    pushItem('fast_kv_storage_hub.dashmap_mem_max_bytes', previewDashmapMemBaseMb * 1024 * 1024);
    pushItem('fast_kv_storage_hub.dashmap_mem_max_bytes_low_memory', previewDashmapMemLowMb * 1024 * 1024);
    pushItem('fast_kv_storage_hub.dashmap_mem_max_bytes_throughput', previewDashmapMemThroughputMb * 1024 * 1024);
    pushItem('internal_notify.unread_count_cache_ttl', previewTuningPlan.notifyUnreadCountCacheTtlSecs);
    pushItem('internal_notify.retention_days', previewTuningPlan.notifyRetentionDays);
    pushItem('system_backup.max_backup_size_mb', previewTuningPlan.systemBackupMaxSizeMb);

    pushItem('middleware.ip_rate_limit.window_secs', previewTuningPlan.middleware.ipWindowSecs);
    pushItem('middleware.ip_rate_limit.max_requests', previewTuningPlan.middleware.ipMaxRequests);
    pushItem('middleware.client_id_rate_limit.window_secs', previewTuningPlan.middleware.clientWindowSecs);
    pushItem('middleware.client_id_rate_limit.max_requests', previewTuningPlan.middleware.clientMaxRequests);
    pushItem('middleware.client_id_rate_limit.max_cid', previewTuningPlan.middleware.clientMaxCid);
    pushItem('middleware.client_id_rate_limit.client_id_blacklist_enabled', false);
    pushItem('middleware.user_id_rate_limit.window_secs', previewTuningPlan.middleware.userWindowSecs);
    pushItem('middleware.user_id_rate_limit.max_requests', previewTuningPlan.middleware.userMaxRequests);
    pushItem('middleware.user_id_rate_limit.max_userid', previewTuningPlan.middleware.userMaxId);
    pushItem('middleware.user_id_rate_limit.user_id_blacklist_enabled', false);
    pushItem('middleware.brute_force.enabled', previewTuningPlan.middleware.bruteForceEnabled);
    pushItem('middleware.brute_force.max_failures_per_user_ip', previewTuningPlan.middleware.bruteForceMaxFailuresPerUserIp);
    pushItem('middleware.brute_force.max_failures_per_ip_global', previewTuningPlan.middleware.bruteForceMaxFailuresPerIpGlobal);
    pushItem('middleware.brute_force.lockout_secs', previewTuningPlan.middleware.bruteForceLockoutSecs);
    pushItem('middleware.brute_force.enable_exponential_backoff', previewTuningPlan.middleware.bruteForceBackoffEnabled);
    pushItem('captcha_code.graphic_cache_size', previewTuningPlan.captchaPreheat.graphicCacheSize);
    pushItem('captcha_code.graphic_gen_concurrency', previewTuningPlan.captchaPreheat.graphicGenConcurrency);
    pushItem('captcha_code.max_gen_concurrency', previewTuningPlan.captchaPreheat.maxGenConcurrency);
    pushItem('captcha_code.pool_check_interval_secs', previewTuningPlan.captchaPreheat.poolCheckIntervalSecs);
    pushItem('captcha_code.emergency_fill_multiplier', previewTuningPlan.captchaPreheat.emergencyFillMultiplier);
    pushItem('memory_allocator.policy', draft.allocatorPolicy);
    pushItem('memory_allocator.profile', draft.allocatorProfile);
    pushItem('extension_manager.plus.startup_parallelism_low_memory', currentPreset.tier === 'extreme-low' || currentPreset.tier === 'low' ? 1 : 2);
    pushItem(
      'extension_manager.plus.startup_parallelism_throughput',
      currentPreset.tier === 'good' ? (draft.loadProfile === 'heavy' ? 6 : 4) : 2
    );

    pushItem('vfs_storage_hub.enable_webdav', currentPreset.features.webdav);
    pushItem('vfs_storage_hub.enable_sftp', currentPreset.features.sftp);
    pushItem('vfs_storage_hub.enable_ftp', currentPreset.features.ftp);
    pushItem('vfs_storage_hub.enable_s3', currentPreset.features.s3);
    pushItem('vfs_storage_hub.max_concurrent_tasks', previewTuningPlan.vfsBatchMaxConcurrentTasks);
    pushItem('vfs_storage_hub.batch_operation.max_concurrent_tasks', previewTuningPlan.vfsBatchMaxConcurrentTasks);
    pushItem('vfs_storage_hub.batch_operation.max_concurrent_tasks_low_memory', previewTuningPlan.vfsBatchMaxConcurrentTasksLowMemory);
    pushItem('vfs_storage_hub.batch_operation.max_concurrent_tasks_throughput', previewTuningPlan.vfsBatchMaxConcurrentTasksThroughput);
    pushItem('vfs_storage_hub.file_compress.enable', currentPreset.features.compression);
    pushItem('vfs_storage_hub.file_compress.process_manager_max_concurrency', previewTuningPlan.compressionConcurrency);
    pushItem('vfs_storage_hub.file_compress.process_manager_max_concurrency_low_memory', previewTuningPlan.compressionConcurrencyLowMemory);
    pushItem('vfs_storage_hub.file_compress.process_manager_max_concurrency_throughput', previewTuningPlan.compressionConcurrencyThroughput);
    pushItem('vfs_storage_hub.file_compress.max_cpu_threads', previewTuningPlan.compressionMaxCpuThreads);
    pushItem('vfs_storage_hub.file_compress.max_cpu_threads_low_memory', previewTuningPlan.compressionMaxCpuThreadsLowMemory);
    pushItem('vfs_storage_hub.file_compress.max_cpu_threads_throughput', previewTuningPlan.compressionMaxCpuThreadsThroughput);
    pushItem('vfs_storage_hub.file_index.max_concurrent_refresh', previewTuningPlan.fileIndexMaxConcurrentRefresh);
    pushItem('vfs_storage_hub.file_index.max_concurrent_refresh_low_memory', previewTuningPlan.fileIndexMaxConcurrentRefreshLowMemory);
    pushItem('vfs_storage_hub.file_index.max_concurrent_refresh_throughput', previewTuningPlan.fileIndexMaxConcurrentRefreshThroughput);

    pushItem('task_registry.bloom_filter_warmup.enabled', currentPreset.features.bloomWarmup);
    pushItem('task_registry.bloom_filter_warmup.cron_expression', previewTuningPlan.scheduler.maintenanceCron);
    pushItem('task_registry.bloom_filter_warmup_tuning.reserve_capacity', previewTuningPlan.bloomWarmupTuning.reserveCapacity);
    pushItem('task_registry.bloom_filter_warmup_tuning.max_users_per_run', previewTuningPlan.bloomWarmupTuning.maxUsersPerRun);
    pushItem('task_registry.bloom_filter_warmup_tuning.yield_every_users', previewTuningPlan.bloomWarmupTuning.yieldEveryUsers);
    pushItem('task_registry.bloom_filter_warmup_tuning.sleep_ms_per_yield', previewTuningPlan.bloomWarmupTuning.sleepMsPerYield);
    pushItem('task_registry.quota_calibration_tuning.max_users_per_run', previewTuningPlan.quotaCalibrationTuning.maxUsersPerRun);
    pushItem('task_registry.quota_calibration_tuning.yield_every_users', previewTuningPlan.quotaCalibrationTuning.yieldEveryUsers);
    pushItem('task_registry.quota_calibration_tuning.sleep_ms_per_user', previewTuningPlan.quotaCalibrationTuning.sleepMsPerUser);
    pushItem('task_registry.file_index_sync_tuning.max_users_per_run', previewTuningPlan.fileIndexSyncTuning.maxUsersPerRun);
    pushItem('task_registry.file_index_sync_tuning.yield_every_users', previewTuningPlan.fileIndexSyncTuning.yieldEveryUsers);
    pushItem('task_registry.file_index_sync_tuning.sleep_ms_per_user', previewTuningPlan.fileIndexSyncTuning.sleepMsPerUser);
    pushItem('task_registry.task_retention_days', previewTuningPlan.taskRetentionDays);
    CRITICAL_TASK_KEYS.forEach((taskName) => {
      pushItem(`task_registry.${taskName}.enabled`, true);
      pushItem(`task_registry.${taskName}.cron_expression`, previewTuningPlan.scheduler.criticalCron);
    });
    MAINTENANCE_TASK_KEYS.forEach((taskName) => {
      pushItem(`task_registry.${taskName}.enabled`, true);
      pushItem(`task_registry.${taskName}.cron_expression`, previewTuningPlan.scheduler.maintenanceCron);
    });
    LOW_PRIORITY_TASK_KEYS.forEach((taskName) => {
      pushItem(`task_registry.${taskName}.enabled`, true);
      pushItem(`task_registry.${taskName}.cron_expression`, previewTuningPlan.scheduler.lowPriorityCron);
    });
    pushItem('task_registry.database_health_check.enabled', true);
    pushItem('task_registry.database_health_check.cron_expression', previewTuningPlan.scheduler.healthCheckCron);

    pushItem('file_manager_serv_sftp.max_connections', currentPreset.features.sftp ? (draft.performanceTier === 'good' ? 100 : 20) : 1);
    pushItem('file_manager_serv_sftp.worker_threads', currentPreset.features.sftp ? (draft.performanceTier === 'good' ? 4 : 2) : 1);
    pushItem('file_manager_serv_ftp.max_connections', currentPreset.features.ftp ? (draft.performanceTier === 'good' ? 100 : 20) : 1);
    pushItem('file_manager_serv_s3.max_connections', currentPreset.features.s3 ? (draft.performanceTier === 'good' ? 100 : 20) : 1);
    pushItem('chat_manager.enabled', currentPreset.features.chat);
    pushItem('chat_manager.rate_limit_window_secs', previewTuningPlan.chatRateLimitWindowSecs);
    pushItem('chat_manager.rate_limit_messages_per_window', previewTuningPlan.chatRateLimitMessagesPerWindow);
    pushItem('chat_manager.ws_session_timeout_secs', previewTuningPlan.chatWsSessionTimeoutSecs);
    pushItem('chat_manager.max_message_size_bytes', previewTuningPlan.chatMaxMessageSizeBytes);
    pushItem('chat_manager.max_groups_per_user', previewTuningPlan.chatMaxGroupsPerUser);
    pushItem('chat_manager.max_members_per_group', previewTuningPlan.chatMaxMembersPerGroup);
    pushItem('chat_manager.max_groups_joined_per_user', previewTuningPlan.chatMaxGroupsJoinedPerUser);
    pushItem('chat_manager.max_guest_invites_per_user', previewTuningPlan.chatMaxGuestInvitesPerUser);
    pushItem('domain_acme_ddns.request_timeout_sec', previewTuningPlan.domainRequestTimeoutSec);
    pushItem('domain_acme_ddns.webhook_timeout_sec', previewTuningPlan.domainWebhookTimeoutSec);
    pushItem('domain_acme_ddns.dns_propagation_wait_sec', previewTuningPlan.domainDnsPropagationWaitSec);
    pushItem('domain_acme_ddns.challenge_poll_interval_sec', previewTuningPlan.domainChallengePollIntervalSec);
    pushItem('domain_acme_ddns.challenge_max_poll_count', previewTuningPlan.domainChallengeMaxPollCount);
    pushItem('email_manager.enabled', currentPreset.features.email);
    pushItem('journal_log.log_retention_days', previewTuningPlan.journalLogRetentionDays);
    pushItem('journal_log.batch_size', previewTuningPlan.journalLogBatchSize);
    pushItem('journal_log.batch_size_low_memory', previewTuningPlan.journalLogBatchSizeLowMemory);
    pushItem('journal_log.batch_size_throughput', previewTuningPlan.journalLogBatchSizeThroughput);
    pushItem('journal_log.flush_interval_ms', previewTuningPlan.journalLogFlushIntervalMs);
    pushItem('journal_log.queue_capacity_multiplier', previewTuningPlan.journalLogQueueCapacityMultiplier);
    pushItem('file_manager_api.webapi_upload_max_file_size', previewTuningPlan.webApiUploadMaxFileSize);
    pushItem('log.enable_async', previewTuningPlan.logEnableAsync);

    return items;
  }, [currentPreset.features, draft.cacheType, draft.databaseType, draft.performanceTier, previewTuningPlan]);

  const previewGroupStats = useMemo<ConfigPreviewGroupStat[]>(() => {
    const groupLabelKeyMap: Record<string, string> = {
      database: 'admin.config.quickWizard.performance.preview.groups.database',
      fast_kv_storage_hub: 'admin.config.quickWizard.performance.preview.groups.cache',
      internal_notify: 'admin.config.quickWizard.performance.preview.groups.scheduler',
      system_backup: 'admin.config.quickWizard.performance.preview.groups.scheduler',
      middleware: 'admin.config.quickWizard.performance.preview.groups.middleware',
      captcha_code: 'admin.config.quickWizard.performance.preview.groups.captcha',
      memory_allocator: 'admin.config.quickWizard.performance.preview.groups.allocator',
      vfs_storage_hub: 'admin.config.quickWizard.performance.preview.groups.vfs',
      task_registry: 'admin.config.quickWizard.performance.preview.groups.scheduler',
      file_manager_serv_sftp: 'admin.config.quickWizard.performance.preview.groups.sftp',
      file_manager_serv_ftp: 'admin.config.quickWizard.performance.preview.groups.ftp',
      file_manager_serv_s3: 'admin.config.quickWizard.performance.preview.groups.s3',
      chat_manager: 'admin.config.quickWizard.performance.preview.groups.chat',
      domain_acme_ddns: 'admin.config.quickWizard.performance.preview.groups.scheduler',
      email_manager: 'admin.config.quickWizard.performance.preview.groups.email',
    };
    const counts = new Map<string, number>();
    previewConfigItems.forEach((item) => {
      const key = item.path.split('.')[0] || 'other';
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([key, count]) => ({
        key,
        labelKey: groupLabelKeyMap[key] || 'admin.config.quickWizard.performance.preview.groups.other',
        count,
      }));
  }, [previewConfigItems]);

  const previewSimpleCards = useMemo(() => {
    const sftpConnectionValue = currentPreset.features.sftp ? (draft.performanceTier === 'good' ? 100 : 20) : 1;
    const ftpConnectionValue = currentPreset.features.ftp ? (draft.performanceTier === 'good' ? 100 : 20) : 1;
    const s3ConnectionValue = currentPreset.features.s3 ? (draft.performanceTier === 'good' ? 100 : 20) : 1;
    return [
      {
        label: t('admin.config.quickWizard.performance.featureS3'),
        value: currentPreset.features.s3 ? t('admin.config.quickWizard.options.enabled') : t('admin.config.quickWizard.options.disabled'),
        enabled: currentPreset.features.s3,
      },
      {
        label: t('admin.config.quickWizard.performance.featureSftp'),
        value: currentPreset.features.sftp ? t('admin.config.quickWizard.options.enabled') : t('admin.config.quickWizard.options.disabled'),
        enabled: currentPreset.features.sftp,
      },
      {
        label: t('admin.config.quickWizard.performance.featureFtp'),
        value: currentPreset.features.ftp ? t('admin.config.quickWizard.options.enabled') : t('admin.config.quickWizard.options.disabled'),
        enabled: currentPreset.features.ftp,
      },
      {
        label: t('admin.config.quickWizard.performance.featureWebdav'),
        value: currentPreset.features.webdav ? t('admin.config.quickWizard.options.enabled') : t('admin.config.quickWizard.options.disabled'),
        enabled: currentPreset.features.webdav,
      },
      {
        label: t('admin.config.quickWizard.performance.featureChat'),
        value: currentPreset.features.chat ? t('admin.config.quickWizard.options.enabled') : t('admin.config.quickWizard.options.disabled'),
        enabled: currentPreset.features.chat,
      },
      {
        label: t('admin.config.quickWizard.performance.featureEmail'),
        value: currentPreset.features.email ? t('admin.config.quickWizard.options.enabled') : t('admin.config.quickWizard.options.disabled'),
        enabled: currentPreset.features.email,
      },
      {
        label: t('admin.config.quickWizard.performance.featureCompression'),
        value: currentPreset.features.compression ? t('admin.config.quickWizard.options.enabled') : t('admin.config.quickWizard.options.disabled'),
        enabled: currentPreset.features.compression,
      },
      {
        label: t('admin.config.quickWizard.performance.featureBloomWarmup'),
        value: currentPreset.features.bloomWarmup ? t('admin.config.quickWizard.options.enabled') : t('admin.config.quickWizard.options.disabled'),
        enabled: currentPreset.features.bloomWarmup,
      },
      {
        label: t('admin.config.quickWizard.performance.preview.dbPool'),
        value: `${previewTuningPlan.dbMinConnections}-${previewTuningPlan.dbMaxConnections}`,
      },
      {
        label: t('admin.config.quickWizard.performance.preview.cacheMemory'),
        value: `${previewTuningPlan.cacheMemoryMB} MB`,
      },
      {
        label: t('admin.config.quickWizard.performance.preview.ipRateLimit'),
        value: `${previewTuningPlan.middleware.ipMaxRequests}/${previewTuningPlan.middleware.ipWindowSecs}s`,
      },
      {
        label: t('admin.config.quickWizard.performance.preview.clientRateLimit'),
        value: `${previewTuningPlan.middleware.clientMaxRequests}/${previewTuningPlan.middleware.clientWindowSecs}s`,
      },
      {
        label: t('admin.config.quickWizard.performance.preview.userRateLimit'),
        value: `${previewTuningPlan.middleware.userMaxRequests}/${previewTuningPlan.middleware.userWindowSecs}s`,
      },
      {
        label: t('admin.config.quickWizard.performance.preview.bruteForceLockout'),
        value: `${previewTuningPlan.middleware.bruteForceLockoutSecs}s`,
      },
      {
        label: t('admin.config.quickWizard.performance.preview.captchaPreheatMode'),
        value: t(`admin.config.quickWizard.performance.preheatMode.options.${draft.captchaPreheatMode}`),
        interactive: draft.performanceTier === 'medium' || draft.performanceTier === 'good',
        options: ['memory', 'balanced', 'throughput'] as CaptchaPreheatMode[],
        current: draft.captchaPreheatMode,
      },
      {
        label: t('admin.config.quickWizard.performance.preview.captchaPreheatPool'),
        value: String(previewTuningPlan.captchaPreheat.graphicCacheSize),
      },
      {
        label: t('admin.config.quickWizard.performance.preview.captchaGenConcurrency'),
        value: `${previewTuningPlan.captchaPreheat.graphicGenConcurrency}/${previewTuningPlan.captchaPreheat.maxGenConcurrency}`,
      },
      {
        label: t('admin.config.quickWizard.performance.preview.captchaPoolCheckInterval'),
        value: `${previewTuningPlan.captchaPreheat.poolCheckIntervalSecs}s`,
      },
      {
        label: t('admin.config.quickWizard.performance.preview.criticalCron'),
        value: previewTuningPlan.scheduler.criticalCron,
      },
      {
        label: t('admin.config.quickWizard.performance.preview.maintenanceCron'),
        value: previewTuningPlan.scheduler.maintenanceCron,
      },
      {
        label: t('admin.config.quickWizard.performance.preview.lowPriorityCron'),
        value: previewTuningPlan.scheduler.lowPriorityCron,
      },
      {
        label: t('admin.config.quickWizard.performance.preview.vfsConcurrency'),
        value: String(previewTuningPlan.vfsBatchMaxConcurrentTasks),
      },
      {
        label: t('admin.config.quickWizard.performance.preview.compressionConcurrency'),
        value: String(previewTuningPlan.compressionConcurrency),
      },
      ...(currentPreset.features.sftp ? [{
        label: t('admin.config.quickWizard.performance.preview.sftpMaxConnections'),
        value: String(sftpConnectionValue),
      }] : []),
      ...(currentPreset.features.ftp ? [{
        label: t('admin.config.quickWizard.performance.preview.ftpMaxConnections'),
        value: String(ftpConnectionValue),
      }] : []),
      ...(currentPreset.features.s3 ? [{
        label: t('admin.config.quickWizard.performance.preview.s3MaxConnections'),
        value: String(s3ConnectionValue),
      }] : []),
    ];
  }, [currentPreset.features, draft.captchaPreheatMode, draft.performanceTier, previewTuningPlan, t]);

  const parsed = useMemo(() => parseConfig(content, tomlAdapter.parse), [content, tomlAdapter]);

  const initializeFromParsed = useCallback(() => {
    if (parsed.value) {
      const nextDraft = {
        ...buildDraftFromConfig(parsed.value, allocatorRecommendation.policy),
        allocatorPolicy: allocatorRecommendation.policy,
      };
      draftRef.current = nextDraft;
      setDraft(nextDraft);
      setParseError(null);
    } else {
      setParseError(parsed.error);
    }
  }, [allocatorRecommendation.policy, parsed.error, parsed.value]);

  useEffect(() => {
    if (!isOpen) {
      hasInitializedRef.current = false;
      isInternalSyncRef.current = false;
      lastObservedContentRef.current = content;
      setShowDetailedPreview(false);
      return;
    }

    const isFirstOpen = !hasInitializedRef.current;
    const contentChanged = lastObservedContentRef.current !== content;
    lastObservedContentRef.current = content;

    if (isFirstOpen) {
      initializeFromParsed();
      setFriendlyStep('performance');
      hasInitializedRef.current = true;
      return;
    }

    if (!contentChanged) {
      return;
    }

    if (isInternalSyncRef.current) {
      isInternalSyncRef.current = false;
      return;
    }

    initializeFromParsed();
  }, [content, initializeFromParsed, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => {
      window.removeEventListener('keydown', handleEsc);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') {
      return undefined;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  const currentStepIndex = friendlySteps.indexOf(friendlyStep);

  const syncDraft = useCallback((updater: (prev: FriendlyDraft) => FriendlyDraft) => {
    const updated = updater(draftRef.current);
    const nextDraft: FriendlyDraft = {
      ...updated,
      allocatorPolicy: allocatorRecommendation.policy,
    };
    draftRef.current = nextDraft;
    setDraft(nextDraft);
    const baseConfig = parsed.value ?? {};
    const nextConfig = applyDraftToConfig(baseConfig, nextDraft, allocatorRecommendation.policy);
    const nextContent = tomlAdapter.stringify(nextConfig);
    isInternalSyncRef.current = true;
    lastObservedContentRef.current = nextContent;
    onContentChange(nextContent);
    setParseError(null);
  }, [allocatorRecommendation.policy, onContentChange, parsed.value, tomlAdapter]);

  if (!isOpen) {
    return null;
  }

  const modalContent = (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-2 sm:p-4" role="dialog" aria-modal="true">
      <div 
        className={cn(
          "absolute inset-0 backdrop-blur-2xl transition-all duration-300",
          isDark ? "bg-black/95" : "bg-slate-900/80"
        )} 
        onClick={onClose} 
      />
      <div className={cn(
        "relative w-full max-w-6xl max-h-[92dvh] rounded-2xl border shadow-2xl overflow-hidden flex flex-col animate-in zoom-in duration-300",
        isDark ? "border-white/10 bg-slate-950 text-slate-100 ring-1 ring-white/5" : "border-slate-300 bg-white text-slate-900"
      )}>
        <div className={cn(
          "flex items-center justify-between gap-2 border-b px-3 py-4 sm:px-6 shrink-0",
          isDark ? "border-white/10 bg-slate-900/50" : "border-slate-200 bg-slate-50/50"
        )}>
          <div className="min-w-0">
            <h3 className="text-sm sm:text-base font-black uppercase tracking-widest truncate">{t('admin.config.quickWizard.title')}</h3>
            <p className={cn("text-[10px] sm:text-xs font-bold uppercase tracking-[0.1em] mt-1", isDark ? "text-slate-500" : "text-slate-400")}>{t('admin.config.quickWizard.subtitle')}</p>
          </div>
          <div className="flex items-center gap-2">
            <button 
              type="button" 
              onClick={onClose} 
              className={cn(
                "h-8 w-8 rounded-lg border inline-flex items-center justify-center transition-colors",
                isDark ? "border-white/15 text-slate-300 hover:bg-white/10" : "border-slate-200 text-slate-600 hover:bg-slate-100"
              )}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain p-3 sm:p-5 space-y-4 custom-scrollbar">
          {parseError && (
            <div className={cn(
              "rounded-xl border p-3 sm:p-4",
              isDark ? "border-amber-500/30 bg-amber-500/10" : "border-amber-200 bg-amber-50"
            )}>
              <div className="flex items-start gap-2 sm:gap-3">
                <AlertTriangle size={18} className={isDark ? "text-amber-300" : "text-amber-600"} />
                <div className="space-y-2">
                  <p className={cn("text-sm font-black", isDark ? "text-amber-100" : "text-amber-900")}>{t('admin.config.quickWizard.parseErrorTitle')}</p>
                  <p className={cn("text-sm sm:text-sm break-words font-mono", isDark ? "text-amber-200/90" : "text-amber-800")}>{parseError}</p>
                  <p className={cn("text-sm", isDark ? "text-amber-200/80" : "text-amber-700")}>{t('admin.config.quickWizard.parseErrorHint')}</p>
                </div>
              </div>
            </div>
          )}

          {!parseError && (
            <div className="space-y-4">
              <div className={cn(
                "rounded-xl border p-2 sm:p-3",
                isDark ? "border-white/10 bg-white/[0.02]" : "border-slate-300 bg-slate-100 shadow-inner"
              )}>
                <div className={cn(
                  'grid grid-cols-1 gap-2',
                  friendlySteps.length >= 4 ? 'sm:grid-cols-4' : 'sm:grid-cols-3',
                )}>
                  {friendlySteps.map((step, index) => (
                    <button
                      key={step}
                      type="button"
                      onClick={() => setFriendlyStep(step)}
                      className={cn(
                        'h-10 rounded-lg text-sm sm:text-sm font-black border transition-all shadow-sm',
                        friendlyStep === step
                          ? (isDark ? 'bg-primary text-white border-primary' : 'bg-primary text-white border-primary')
                          : index < currentStepIndex
                            ? (isDark ? 'bg-emerald-500/10 text-emerald-200 border-emerald-500/30' : 'bg-emerald-50 text-emerald-800 border-emerald-200')
                            : (isDark ? 'bg-black/20 text-slate-300 border-white/10 hover:bg-white/10' : 'bg-white text-slate-900 border-slate-300 hover:bg-slate-50 shadow-sm'),
                      )}
                    >
                      {index + 1}. {t(`admin.config.quickWizard.steps.${step}`)}
                    </button>
                  ))}
                </div>
              </div>

              {friendlyStep === 'performance' && (
                <section className={cn(
                  "rounded-2xl border p-3 sm:p-4 shadow-sm",
                  isDark ? "border-white/10 bg-white/[0.03]" : "border-slate-200 bg-white"
                )}>
                  <div className="flex items-center gap-2 mb-3">
                    <Cpu size={16} className={isDark ? "text-purple-300" : "text-purple-600"} />
                    <h4 className="text-sm sm:text-sm font-black uppercase tracking-wide">{t('admin.config.quickWizard.steps.performance')}</h4>
                  </div>
                  <p className={cn("text-sm sm:text-sm mb-4", isDark ? "text-slate-400" : "text-slate-800 font-black")}>{t('admin.config.quickWizard.performance.intro')}</p>
                  <div className={cn(
                    "mb-4 rounded-lg border px-3 py-2 text-sm font-black",
                    isDark ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-200" : "border-cyan-200 bg-cyan-50 text-cyan-800"
                  )}>
                    {t(
                      allocatorRecommendation.policy === 'jemalloc'
                        ? 'admin.config.quickWizard.performance.allocatorRecommendationLinux'
                        : 'admin.config.quickWizard.performance.allocatorRecommendationOthers',
                      { os: allocatorRecommendation.os }
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {PERFORMANCE_PRESETS.map((preset) => (
                      <button
                        key={preset.tier}
                        type="button"
                        onClick={() => {
                          syncDraft((prev) => {
                            const isLowMem = preset.tier === 'extreme-low' || preset.tier === 'low';
                            const next = {
                              ...prev,
                              performanceTier: preset.tier,
                              databaseType: preset.recommendations.databaseType,
                              cacheType: preset.recommendations.cacheType,
                              loadProfile: (preset.tier === 'medium' || preset.tier === 'good') ? 'heavy' : prev.loadProfile,
                              captchaPreheatMode: isLowMem ? 'memory' : 'balanced' as CaptchaPreheatMode,
                            };
                            if (preset.recommendations.databaseType === 'sqlite') {
                              next.sqlitePath = '{APPDATADIR}/fileuni.db';
                              next.sqliteDsn = 'sqlite://{APPDATADIR}/fileuni.db';
                            }
                            return next;
                          });
                        }}
                        className={cn(
                          'relative p-3 rounded-xl border text-left transition-all',
                          draft.performanceTier === preset.tier
                            ? (isDark ? 'border-purple-400/50 bg-purple-500/10 ring-1 ring-purple-400/30 shadow-black/40 shadow-lg' : 'border-purple-500 bg-purple-50 ring-1 ring-purple-200 shadow-purple-100 shadow-lg')
                            : (isDark ? 'border-white/10 bg-black/20 hover:bg-white/5' : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100')
                        )}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <div className={cn(
                            'w-3 h-3 rounded-full',
                            preset.tier === 'extreme-low' ? 'bg-red-400' :
                            preset.tier === 'low' ? 'bg-amber-400' :
                            preset.tier === 'medium' ? 'bg-blue-400' :
                            'bg-emerald-400'
                          )} />
                          <span className="text-sm sm:text-sm font-black">{t(preset.labelKey)}</span>
                        </div>
                        <p className={cn("text-sm sm:text-sm line-clamp-2", isDark ? "text-slate-400" : "text-slate-800 font-black")}>{t(preset.descKey)}</p>
                        <div className="mt-2 flex flex-wrap gap-1">
                          <span className={cn(
                            "text-sm px-1.5 py-0.5 rounded border font-black",
                            isDark ? "bg-white/10 text-slate-300 border-transparent" : "bg-white text-slate-700 border-slate-200"
                          )}>
                            {preset.recommendations.databaseType === 'sqlite'
                              ? t('admin.config.quickWizard.options.sqlite')
                              : t('admin.config.quickWizard.options.postgres')}
                          </span>
                          <span className={cn(
                            "text-sm px-1.5 py-0.5 rounded border font-black",
                            isDark ? "bg-white/10 text-slate-300 border-transparent" : "bg-white text-slate-700 border-slate-200"
                          )}>
                            {t(`admin.config.quickWizard.options.cache${preset.recommendations.cacheType.charAt(0).toUpperCase()}${preset.recommendations.cacheType.slice(1)}`)}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>

                  {(draft.performanceTier === 'medium' || draft.performanceTier === 'good') && (
                    <div className={cn(
                      "mt-4 rounded-xl border p-3 shadow-inner transition-colors",
                      isDark ? "border-purple-500/30 bg-purple-500/5" : "border-purple-200 bg-purple-50/50"
                    )}>
                      <div className={cn("text-sm font-black mb-2", isDark ? "text-purple-200" : "text-purple-900")}>{t('admin.config.quickWizard.performance.loadProfile.title')}</div>
                      <p className={cn("text-sm mb-3", isDark ? "text-slate-400" : "text-slate-800 font-black")}>{t('admin.config.quickWizard.performance.loadProfile.desc')}</p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => syncDraft((prev) => ({ ...prev, loadProfile: 'light' }))}
                          className={cn(
                            'flex-1 p-2 rounded-lg border text-left transition-all font-black',
                            draft.loadProfile === 'light'
                              ? (isDark ? 'border-emerald-400/50 bg-emerald-500/10' : 'border-emerald-500 bg-emerald-100 shadow-sm')
                              : (isDark ? 'border-white/10 bg-black/20 hover:bg-white/5' : 'border-slate-200 bg-white hover:bg-slate-100')
                          )}
                        >
                          <div className="text-sm">{t('admin.config.quickWizard.performance.loadProfile.light')}</div>
                          <div className={cn("text-sm", isDark ? "text-slate-400" : "text-slate-500")}>{t('admin.config.quickWizard.performance.loadProfile.lightDesc')}</div>
                        </button>
                        <button
                          type="button"
                          onClick={() => syncDraft((prev) => ({ ...prev, loadProfile: 'heavy' }))}
                          className={cn(
                            'flex-1 p-2 rounded-lg border text-left transition-all font-black',
                            draft.loadProfile === 'heavy'
                              ? (isDark ? 'border-orange-400/50 bg-orange-500/10' : 'border-orange-500 bg-orange-100 shadow-sm')
                              : (isDark ? 'border-white/10 bg-black/20 hover:bg-white/5' : 'border-slate-200 bg-white hover:bg-slate-100')
                          )}
                        >
                          <div className="text-sm">{t('admin.config.quickWizard.performance.loadProfile.heavy')}</div>
                          <div className={cn("text-sm", isDark ? "text-slate-400" : "text-slate-500")}>{t('admin.config.quickWizard.performance.loadProfile.heavyDesc')}</div>
                        </button>
                      </div>
                    </div>
                  )}

                  {draft.performanceTier === 'good' && (
                    <div className={cn(
                      "mt-4 rounded-xl border p-3",
                      isDark ? "border-cyan-500/30 bg-cyan-500/5" : "border-cyan-200 bg-cyan-50"
                    )}>
                      <div className="flex items-start gap-2">
                        <AlertTriangle size={16} className={isDark ? "text-cyan-300" : "text-cyan-600"} />
                        <div>
                          <div className={cn("text-sm font-black mb-1", isDark ? "text-cyan-200" : "text-cyan-900")}>{t('admin.config.quickWizard.performance.performanceTips.title')}</div>
                          <ul className={cn("text-sm space-y-1", isDark ? "text-cyan-200/80" : "text-cyan-800 font-bold")}>
                            <li>• {t('admin.config.quickWizard.performance.performanceTips.raid')}</li>
                            <li>• {t('admin.config.quickWizard.performance.performanceTips.pgsql')}</li>
                            <li>• {t('admin.config.quickWizard.performance.performanceTips.memory')}</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className={cn(
                    "mt-4 rounded-xl border p-3 shadow-sm",
                    isDark ? "border-white/10 bg-black/20" : "border-slate-200 bg-slate-50"
                  )}>
                    <div className="flex items-center gap-2 mb-3">
                      <Wand2 size={18} className="text-primary" />
                      <div className={cn("text-sm uppercase font-black tracking-widest", isDark ? "opacity-60" : "text-slate-500")}>{t('admin.config.quickWizard.performance.recommendedSettings')}</div>
                    </div>
                    
                    <div className={cn("text-sm mb-3 font-bold", isDark ? "text-slate-400" : "text-slate-600")}>{t('admin.config.quickWizard.performance.preview.simpleHint')}</div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2">
                      {previewSimpleCards.map((card) => (
                        <div key={`${card.label}:${card.value}`} className={cn(
                          "rounded-lg border px-2.5 py-2 transition-all flex flex-col",
                          isDark ? "border-white/5 bg-black/30" : "border-slate-200 bg-white"
                        )}>
                          <div className={cn("text-sm uppercase font-black mb-1.5 truncate", isDark ? "text-slate-500" : "text-slate-400")}>{card.label}</div>
                          
                          {'interactive' in card && card.interactive ? (
                            <div className="flex flex-wrap gap-1 mt-auto">
                              {(card.options as CaptchaPreheatMode[]).map(opt => (
                                <button
                                  key={opt}
                                  type="button"
                                  onClick={() => syncDraft(prev => ({ ...prev, captchaPreheatMode: opt }))}
                                  className={cn(
                                    "px-1.5 py-0.5 rounded text-sm font-black border transition-all",
                                    card.current === opt
                                      ? (isDark ? "bg-primary/20 border-primary/40 text-primary" : "bg-primary text-white border-primary")
                                      : (isDark ? "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10" : "bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200")
                                  )}
                                >
                                  {t(`admin.config.quickWizard.performance.preheatMode.options.${opt}`)}
                                </button>
                              ))}
                            </div>
                          ) : (
                            <div className={cn(
                              'text-sm font-black mt-auto truncate', 
                              card.enabled === undefined 
                                ? (isDark ? 'text-slate-100' : 'text-slate-900') 
                                : card.enabled 
                                  ? (isDark ? 'text-emerald-300' : 'text-emerald-700') 
                                  : (isDark ? 'text-red-300' : 'text-red-700')
                            )}>
                              {card.value}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    
                    <div className="mt-3 flex items-center justify-between">
                      <div className={cn("text-sm font-black uppercase opacity-40 shrink-0", isDark ? "text-white" : "text-slate-900")}>
                        {t('admin.config.quickWizard.performance.preview.totalChanges', { count: previewConfigItems.length })}
                      </div>
                      <button
                        type="button"
                        className={cn(
                          "h-8 px-3 rounded-lg border text-sm font-black transition-all shadow-sm shrink-0",
                          isDark ? "border-white/15 bg-white/5 hover:bg-white/10 text-slate-300" : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                        )}
                        onClick={() => setShowDetailedPreview((prev) => !prev)}
                      >
                        {showDetailedPreview
                          ? t('admin.config.quickWizard.performance.preview.hideDetails')
                          : t('admin.config.quickWizard.performance.preview.viewDetails')}
                      </button>
                    </div>

                    {showDetailedPreview && (
                      <div className={cn(
                        "grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-3 mt-3 pt-3 border-t",
                        isDark ? "border-white/10" : "border-slate-200"
                      )}>
                        <div className={cn(
                          "rounded-lg border overflow-hidden",
                          isDark ? "border-white/10 bg-black/30" : "border-slate-200 bg-white"
                        )}>
                          <div className={cn(
                            "grid grid-cols-[1fr_auto] gap-2 border-b px-2.5 py-2 text-sm font-black uppercase tracking-wider",
                            isDark ? "border-white/10 text-slate-400 bg-white/5" : "border-slate-300 text-slate-600 bg-slate-100"
                          )}>
                            <div>{t('admin.config.quickWizard.performance.preview.path')}</div>
                            <div>{t('admin.config.quickWizard.performance.preview.value')}</div>
                          </div>
                          <div className="max-h-80 overflow-auto custom-scrollbar">
                            {previewConfigItems.map((item) => (
                              <div
                                key={`${item.path}:${item.value}`}
                                className={cn(
                                  "grid grid-cols-[1fr_auto] gap-2 border-b px-2.5 py-1.5 text-sm last:border-b-0",
                                  isDark ? "border-white/10 hover:bg-white/5" : "border-slate-100 hover:bg-slate-50"
                                )}
                              >
                                <div className={cn("font-mono break-all font-bold", isDark ? "text-slate-300" : "text-slate-700")}>{item.path}</div>
                                <div className={cn("font-mono font-black", isDark ? "text-cyan-300" : "text-cyan-700")}>{item.value}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className={cn(
                          "rounded-lg border p-2.5 flex flex-col",
                          isDark ? "border-white/10 bg-black/30" : "border-slate-200 bg-white"
                        )}>
                          <div className={cn("text-sm uppercase font-black opacity-60 mb-2", isDark ? "text-white" : "text-slate-500")}>{t('admin.config.quickWizard.performance.preview.groupStats')}</div>
                          <div className="space-y-1.5">
                            {previewGroupStats.map((group) => (
                              <div
                                key={`${group.key}:${group.count}`}
                                className={cn(
                                  "flex items-center justify-between rounded border px-2 py-1.5 text-sm font-bold",
                                  isDark ? "border-white/10 bg-black/20 text-slate-300" : "border-slate-100 bg-slate-50 text-slate-700"
                                )}
                              >
                                <span>{t(group.labelKey)}</span>
                                <span className={cn("font-mono font-black", isDark ? "text-cyan-300" : "text-cyan-700")}>{group.count}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </section>
              )}

              {friendlyStep === 'database' && (
                <section className={cn(
                  "rounded-2xl border p-3 sm:p-4 shadow-sm",
                  isDark ? "border-white/10 bg-white/[0.03]" : "border-slate-200 bg-white"
                )}>
                  <div className="flex items-center gap-2 mb-3">
                    <Settings2 size={16} className={isDark ? "text-cyan-300" : "text-cyan-600"} />
                    <h4 className="text-sm sm:text-sm font-black uppercase tracking-wide">{t('admin.config.quickWizard.steps.database')}</h4>
                  </div>

                  <div className="mb-3">
                    <div className={cn("text-sm font-black mb-2", isDark ? "text-slate-300" : "text-slate-700")}>{t('admin.config.quickWizard.fields.dbType')}</div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => syncDraft((prev) => ({ ...prev, databaseType: 'postgres' }))}
                        className={cn(
                          'flex-1 h-10 rounded-lg border text-sm font-black transition-all',
                          draft.databaseType === 'postgres'
                            ? (isDark ? 'bg-cyan-500/20 border-cyan-400/40 text-cyan-200' : 'bg-cyan-500 text-white border-cyan-600 shadow-md')
                            : (isDark ? 'bg-black/30 border-white/15 text-slate-300 hover:bg-white/10' : 'bg-white border-slate-300 text-slate-900 hover:bg-slate-50 shadow-sm')
                        )}
                      >
                        {t('admin.config.quickWizard.options.postgres')}
                      </button>
                      <button
                        type="button"
                        onClick={() => syncDraft((prev) => ({ ...prev, databaseType: 'sqlite' }))}
                        className={cn(
                          'flex-1 h-10 rounded-lg border text-sm font-black transition-all',
                          draft.databaseType === 'sqlite'
                            ? (isDark ? 'bg-cyan-500/20 border-cyan-400/40 text-cyan-200' : 'bg-cyan-500 text-white border-cyan-600 shadow-md')
                            : (isDark ? 'bg-black/30 border-white/15 text-slate-300 hover:bg-white/10' : 'bg-white border-slate-300 text-slate-900 hover:bg-slate-50 shadow-sm')
                        )}
                      >
                        {t('admin.config.quickWizard.options.sqlite')}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <label className={cn("text-sm font-black", isDark ? "text-slate-300" : "text-slate-700")}>
                      {t('admin.config.quickWizard.fields.healthTimeoutSeconds')}
                      <input
                        className={cn(
                          "mt-1 w-full h-10 rounded-lg border px-3 text-sm transition-all focus:outline-none focus:ring-2",
                          isDark ? "border-white/15 bg-black/30 text-white focus:ring-cyan-500/30" : "border-slate-300 bg-white text-slate-900 focus:ring-cyan-500/20 shadow-sm"
                        )}
                        value={draft.dbHealthTimeoutSeconds}
                        onChange={(event) => {
                          const value = event.target.value;
                          syncDraft((prev) => ({ ...prev, dbHealthTimeoutSeconds: value }));
                        }}
                      />
                    </label>
                  </div>

                  {draft.databaseType === 'postgres' ? (
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <label className={cn("text-sm font-black", isDark ? "text-slate-300" : "text-slate-700")}>
                        {t('admin.config.quickWizard.fields.host')}
                        <input
                          className={cn(
                            "mt-1 w-full h-10 rounded-lg border px-3 text-sm focus:outline-none focus:ring-2",
                            isDark ? "border-white/15 bg-black/30 text-white focus:ring-cyan-500/30" : "border-slate-300 bg-white text-slate-900 focus:ring-cyan-500/20 shadow-sm"
                          )}
                          value={draft.dbHost}
                          onChange={(event) => {
                            const dbHost = event.target.value;
                            syncDraft((prev) => {
                              const next = { ...prev, dbHost };
                              next.postgresDsn = buildPostgresDsn(next);
                              return next;
                            });
                          }}
                        />
                      </label>
                      <label className={cn("text-sm font-black", isDark ? "text-slate-300" : "text-slate-700")}>
                        {t('admin.config.quickWizard.fields.port')}
                        <input
                          className={cn(
                            "mt-1 w-full h-10 rounded-lg border px-3 text-sm focus:outline-none focus:ring-2",
                            isDark ? "border-white/15 bg-black/30 text-white focus:ring-cyan-500/30" : "border-slate-300 bg-white text-slate-900 focus:ring-cyan-500/20 shadow-sm"
                          )}
                          value={draft.dbPort}
                          onChange={(event) => {
                            const dbPort = event.target.value;
                            syncDraft((prev) => {
                              const next = { ...prev, dbPort };
                              next.postgresDsn = buildPostgresDsn(next);
                              return next;
                            });
                          }}
                        />
                      </label>
                      <label className={cn("text-sm font-black", isDark ? "text-slate-300" : "text-slate-700")}>
                        {t('admin.config.quickWizard.fields.user')}
                        <input
                          className={cn(
                            "mt-1 w-full h-10 rounded-lg border px-3 text-sm focus:outline-none focus:ring-2",
                            isDark ? "border-white/15 bg-black/30 text-white focus:ring-cyan-500/30" : "border-slate-300 bg-white text-slate-900 focus:ring-cyan-500/20 shadow-sm"
                          )}
                          value={draft.dbUser}
                          onChange={(event) => {
                            const dbUser = event.target.value;
                            syncDraft((prev) => {
                              const next = { ...prev, dbUser };
                              next.postgresDsn = buildPostgresDsn(next);
                              return next;
                            });
                          }}
                        />
                      </label>
                      <label className={cn("text-sm font-black", isDark ? "text-slate-300" : "text-slate-700")}>
                        {t('admin.config.quickWizard.fields.password')}
                        <input
                          type="password"
                          className={cn(
                            "mt-1 w-full h-10 rounded-lg border px-3 text-sm focus:outline-none focus:ring-2",
                            isDark ? "border-white/15 bg-black/30 text-white focus:ring-cyan-500/30" : "border-slate-300 bg-white text-slate-900 focus:ring-cyan-500/20 shadow-sm"
                          )}
                          value={draft.dbPass}
                          onChange={(event) => {
                            const dbPass = event.target.value;
                            syncDraft((prev) => {
                              const next = { ...prev, dbPass };
                              next.postgresDsn = buildPostgresDsn(next);
                              return next;
                            });
                          }}
                        />
                      </label>
                      <label className={cn("text-sm font-black sm:col-span-2", isDark ? "text-slate-300" : "text-slate-700")}>
                        {t('admin.config.quickWizard.fields.databaseName')}
                        <input
                          className={cn(
                            "mt-1 w-full h-10 rounded-lg border px-3 text-sm focus:outline-none focus:ring-2",
                            isDark ? "border-white/15 bg-black/30 text-white focus:ring-cyan-500/30" : "border-slate-300 bg-white text-slate-900 focus:ring-cyan-500/20 shadow-sm"
                          )}
                          value={draft.dbName}
                          onChange={(event) => {
                            const dbName = event.target.value;
                            syncDraft((prev) => {
                              const next = { ...prev, dbName };
                              next.postgresDsn = buildPostgresDsn(next);
                              return next;
                            });
                          }}
                        />
                      </label>
                      <label className={cn("text-sm font-black sm:col-span-2", isDark ? "text-slate-300" : "text-slate-700")}>
                        {t('admin.config.quickWizard.fields.postgresDsn')}
                        <input
                          className={cn(
                            "mt-1 w-full h-10 rounded-lg border px-3 text-sm font-mono focus:outline-none focus:ring-2",
                            isDark ? "border-cyan-400/30 bg-black/40 text-cyan-200 focus:ring-cyan-500/30" : "border-cyan-300 bg-cyan-50 text-cyan-900 focus:ring-cyan-500/20"
                          )}
                          value={draft.postgresDsn}
                          onChange={(event) => {
                            const postgresDsn = event.target.value;
                            const parsedFields = parsePostgresDsn(postgresDsn);
                            syncDraft((prev) => ({
                              ...prev,
                              postgresDsn,
                              dbHost: parsedFields.dbHost,
                              dbPort: parsedFields.dbPort,
                              dbUser: parsedFields.dbUser,
                              dbPass: parsedFields.dbPass,
                              dbName: parsedFields.dbName,
                            }));
                          }}
                        />
                      </label>
                    </div>
                  ) : (
                    <div className="mt-3 grid grid-cols-1 gap-3">
                      <label className={cn("text-sm font-black", isDark ? "text-slate-300" : "text-slate-700")}>
                        {t('admin.config.quickWizard.fields.sqlitePath')}
                        <input
                          className={cn(
                            "mt-1 w-full h-10 rounded-lg border px-3 text-sm font-mono focus:outline-none focus:ring-2",
                            isDark ? "border-white/15 bg-black/30 text-white focus:ring-cyan-500/30" : "border-slate-300 bg-white text-slate-900 focus:ring-cyan-500/20 shadow-sm"
                          )}
                          value={draft.sqlitePath}
                          onChange={(event) => {
                            const sqlitePath = event.target.value;
                            syncDraft((prev) => {
                              const next = { ...prev, sqlitePath };
                              next.sqliteDsn = buildSqliteDsn(sqlitePath);
                              return next;
                            });
                          }}
                        />
                      </label>
                      <label className={cn("text-sm font-black", isDark ? "text-slate-300" : "text-slate-700")}>
                        {t('admin.config.quickWizard.fields.sqliteDsn')}
                        <input
                          className={cn(
                            "mt-1 w-full h-10 rounded-lg border px-3 text-sm font-mono focus:outline-none focus:ring-2",
                            isDark ? "border-cyan-400/30 bg-black/40 text-cyan-200 focus:ring-cyan-500/30" : "border-cyan-300 bg-cyan-50 text-cyan-900 focus:ring-cyan-500/20"
                          )}
                          value={draft.sqliteDsn}
                          onChange={(event) => {
                            const sqliteDsn = event.target.value;
                            syncDraft((prev) => ({
                              ...prev,
                              sqliteDsn,
                              sqlitePath: parseSqlitePath(sqliteDsn),
                            }));
                          }}
                        />
                      </label>
                    </div>
                  )}
                </section>
              )}

              {friendlyStep === 'cache' && (
                <section className={cn(
                  "rounded-2xl border p-3 sm:p-4 shadow-sm",
                  isDark ? "border-white/10 bg-white/[0.03]" : "border-slate-200 bg-white"
                )}>
                  <h4 className="text-sm sm:text-sm font-black uppercase tracking-wide mb-3">{t('admin.config.quickWizard.steps.cache')}</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="md:col-span-2">
                      <div className={cn("text-sm font-black mb-2", isDark ? "text-slate-300" : "text-slate-700")}>{t('admin.config.quickWizard.fields.cacheType')}</div>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                        {[
                          { value: 'valkey', label: t('admin.config.quickWizard.options.cacheValkey') },
                          { value: 'redis', label: t('admin.config.quickWizard.options.cacheRedis') },
                          { value: 'keydb', label: t('admin.config.quickWizard.options.cacheKeydb') },
                          { value: 'dashmap', label: t('admin.config.quickWizard.options.cacheDashmap') },
                          { value: 'database', label: t('admin.config.quickWizard.options.cacheDatabase') },
                        ].map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => syncDraft((prev) => ({ ...prev, cacheType: option.value }))}
                            className={cn(
                              'h-10 rounded-lg border text-sm font-black transition-all',
                              draft.cacheType === option.value
                                ? (isDark ? 'bg-cyan-500/20 border-cyan-400/40 text-cyan-200' : 'bg-cyan-500 text-white border-cyan-600 shadow-md')
                                : (isDark ? 'bg-black/30 border-white/15 text-slate-300 hover:bg-white/10' : 'bg-white border-slate-300 text-slate-900 hover:bg-slate-50 shadow-sm')
                            )}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <label className={cn("text-sm font-black", isDark ? "text-slate-300" : "text-slate-700")}>
                      {t('admin.config.quickWizard.fields.useTls')}
                      <button
                        type="button"
                        className={cn(
                          'mt-1 h-10 w-full rounded-lg border font-black transition-all shadow-sm',
                          draft.cacheUseTls
                            ? (isDark ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-200' : 'bg-emerald-500 text-white border-emerald-600')
                            : (isDark ? 'bg-black/30 border-white/15 text-slate-200' : 'bg-white border-slate-300 text-slate-900 shadow-sm'),
                        )}
                        onClick={() => {
                          syncDraft((prev) => {
                            const next = { ...prev, cacheUseTls: !prev.cacheUseTls };
                            next.cacheRedisUrl = buildRedisUrl(next);
                            return next;
                          });
                        }}
                      >
                        {draft.cacheUseTls ? t('admin.config.quickWizard.options.enabled') : t('admin.config.quickWizard.options.disabled')}
                      </button>
                    </label>
                  </div>
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className={cn("text-sm font-black", isDark ? "text-slate-300" : "text-slate-700")}>
                      {t('admin.config.quickWizard.fields.host')}
                      <input
                        className={cn(
                          "mt-1 w-full h-10 rounded-lg border px-3 text-sm focus:outline-none focus:ring-2",
                          isDark ? "border-white/15 bg-black/30 text-white focus:ring-cyan-500/30" : "border-slate-300 bg-white text-slate-900 focus:ring-cyan-500/20 shadow-sm"
                        )}
                        value={draft.cacheHost}
                        onChange={(event) => {
                          const cacheHost = event.target.value;
                          syncDraft((prev) => {
                            const next = { ...prev, cacheHost };
                            next.cacheRedisUrl = buildRedisUrl(next);
                            return next;
                          });
                        }}
                      />
                    </label>
                    <label className={cn("text-sm font-black", isDark ? "text-slate-300" : "text-slate-700")}>
                      {t('admin.config.quickWizard.fields.port')}
                      <input
                        className={cn(
                          "mt-1 w-full h-10 rounded-lg border px-3 text-sm focus:outline-none focus:ring-2",
                          isDark ? "border-white/15 bg-black/30 text-white focus:ring-cyan-500/30" : "border-slate-300 bg-white text-slate-900 focus:ring-cyan-500/20 shadow-sm"
                        )}
                        value={draft.cachePort}
                        onChange={(event) => {
                          const cachePort = event.target.value;
                          syncDraft((prev) => {
                            const next = { ...prev, cachePort };
                            next.cacheRedisUrl = buildRedisUrl(next);
                            return next;
                          });
                        }}
                      />
                    </label>
                    <label className={cn("text-sm font-black", isDark ? "text-slate-300" : "text-slate-700")}>
                      {t('admin.config.quickWizard.fields.user')}
                      <input
                        className={cn(
                          "mt-1 w-full h-10 rounded-lg border px-3 text-sm focus:outline-none focus:ring-2",
                          isDark ? "border-white/15 bg-black/30 text-white focus:ring-cyan-500/30" : "border-slate-300 bg-white text-slate-900 focus:ring-cyan-500/20 shadow-sm"
                        )}
                        value={draft.cacheUser}
                        onChange={(event) => {
                          const cacheUser = event.target.value;
                          syncDraft((prev) => {
                            const next = { ...prev, cacheUser };
                            next.cacheRedisUrl = buildRedisUrl(next);
                            return next;
                          });
                        }}
                      />
                    </label>
                    <label className={cn("text-sm font-black", isDark ? "text-slate-300" : "text-slate-700")}>
                      {t('admin.config.quickWizard.fields.password')}
                      <input
                        type="password"
                        className={cn(
                          "mt-1 w-full h-10 rounded-lg border px-3 text-sm focus:outline-none focus:ring-2",
                          isDark ? "border-white/15 bg-black/30 text-white focus:ring-cyan-500/30" : "border-slate-300 bg-white text-slate-900 focus:ring-cyan-500/20 shadow-sm"
                        )}
                        value={draft.cachePass}
                        onChange={(event) => {
                          const cachePass = event.target.value;
                          syncDraft((prev) => {
                            const next = { ...prev, cachePass };
                            next.cacheRedisUrl = buildRedisUrl(next);
                            return next;
                          });
                        }}
                      />
                    </label>
                    <label className={cn("text-sm font-black sm:col-span-2", isDark ? "text-slate-300" : "text-slate-700")}>
                      {t('admin.config.quickWizard.fields.redisUrl')}
                      <input
                        className={cn(
                          "mt-1 w-full h-10 rounded-lg border px-3 text-sm font-mono focus:outline-none focus:ring-2",
                          isDark ? "border-cyan-400/30 bg-black/40 text-cyan-200 focus:ring-cyan-500/30" : "border-cyan-300 bg-cyan-50 text-cyan-900 focus:ring-cyan-500/20"
                        )}
                        value={draft.cacheRedisUrl}
                        onChange={(event) => {
                          const cacheRedisUrl = event.target.value;
                          const fields = parseRedisUrl(cacheRedisUrl);
                          syncDraft((prev) => ({
                            ...prev,
                            cacheRedisUrl,
                            cacheHost: fields.cacheHost,
                            cachePort: fields.cachePort,
                            cacheUser: fields.cacheUser,
                            cachePass: fields.cachePass,
                            cacheUseTls: fields.cacheUseTls,
                          }));
                        }}
                      />
                    </label>
                  </div>
                </section>
              )}

              {friendlyStep === 'advanced' && (
                <section className={cn(
                  "rounded-2xl border p-3 sm:p-4 shadow-sm",
                  isDark ? "border-white/10 bg-white/[0.03]" : "border-slate-200 bg-white"
                )}>
                  <h4 className="text-sm sm:text-sm font-black uppercase tracking-wide mb-3">{t('admin.config.quickWizard.steps.advanced')}</h4>
                  <p className={cn("text-sm sm:text-sm mb-3", isDark ? "text-slate-400" : "text-slate-800 font-black")}>{t('admin.config.quickWizard.advancedActions.intro')}</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {licenseWizard && (
                      <button
                        type="button"
                        className={cn(
                          "h-12 rounded-lg border text-sm sm:text-sm font-black transition-all inline-flex items-center justify-center gap-2 shadow-sm",
                          isDark 
                            ? "border-amber-500/40 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20" 
                            : "border-amber-500/50 bg-amber-50 text-amber-900 hover:bg-amber-100"
                        )}
                        onClick={() => setIsLicenseModalOpen(true)}
                      >
                        <Key size={18} className={isDark ? "text-amber-400" : "text-amber-600"} />
                        {t('admin.config.quickWizard.steps.license')}
                      </button>
                    )}
                    <button
                      type="button"
                      className={cn(
                        "h-12 rounded-lg border text-sm sm:text-sm font-black transition-all disabled:opacity-50 shadow-sm",
                        isDark 
                          ? "border-cyan-400/40 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/20" 
                          : "border-cyan-500/50 bg-cyan-50 text-cyan-900 hover:bg-cyan-100"
                      )}
                      onClick={() => {
                        if (onResetAdminPassword) {
                          setShowAdminPasswordPanel(true);
                        }
                      }}
                      disabled={!onResetAdminPassword}
                    >
                      {t('admin.config.quickWizard.advancedActions.changeAdminPassword')}
                    </button>
                  </div>
                </section>
              )}

              {friendlyStep === 'license' && licenseWizard && (
                <section className={cn(
                  "rounded-2xl border p-3 sm:p-4 space-y-3 shadow-sm",
                  isDark ? "border-white/10 bg-white/[0.03]" : "border-slate-200 bg-white"
                )}>
                  <h4 className="text-sm sm:text-sm font-black uppercase tracking-wide mb-1">{t('admin.config.quickWizard.steps.license')}</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className={cn(
                      "rounded-lg border p-3",
                      isDark ? "border-white/10 bg-black/20" : "border-slate-100 bg-slate-50"
                    )}>
                      <div className={cn("text-sm uppercase font-black opacity-60 mb-1", isDark ? "text-white" : "text-slate-500")}>{t('admin.config.quickWizard.fields.licenseStatus')}</div>
                      <div className={cn(
                        'text-sm font-black',
                        licenseWizard.isValid ? (isDark ? 'text-emerald-300' : 'text-emerald-700') : (isDark ? 'text-red-300' : 'text-red-700'),
                      )}>
                        {licenseWizard.isValid
                          ? t('admin.config.quickWizard.options.licenseAuthorized')
                          : t('admin.config.quickWizard.options.licenseUnauthorized')}
                      </div>
                    </div>
                    <div className={cn(
                      "rounded-lg border p-3",
                      isDark ? "border-white/10 bg-black/20" : "border-slate-100 bg-slate-50"
                    )}>
                      <div className={cn("text-sm uppercase font-black opacity-60 mb-1", isDark ? "text-white" : "text-slate-500")}>{t('admin.config.quickWizard.fields.maxUsers')}</div>
                      <div className="text-sm font-black">{licenseWizard.currentUsers} / {licenseWizard.maxUsers}</div>
                    </div>
                    <div className={cn(
                      "rounded-lg border p-3 sm:col-span-2",
                      isDark ? "border-white/10 bg-black/20" : "border-slate-100 bg-slate-50"
                    )}>
                      <div className={cn("text-sm uppercase font-black opacity-60 mb-1", isDark ? "text-white" : "text-slate-500")}>{t('admin.config.quickWizard.fields.hwFingerprint')}</div>
                      <div className={cn("text-sm sm:text-sm font-mono break-all font-bold", isDark ? "text-white" : "text-slate-800")}>{licenseWizard.deviceCode || '-'}</div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className={cn("text-sm font-black", isDark ? "text-slate-300" : "text-slate-700")}>{t('admin.config.quickWizard.fields.licenseKey')}</label>
                    <input
                      className={cn(
                        "w-full h-10 rounded-lg border px-3 text-sm focus:outline-none focus:ring-2",
                        isDark ? "border-white/15 bg-black/30 text-white focus:ring-primary/30" : "border-slate-300 bg-white text-slate-900 focus:ring-primary/20 shadow-sm"
                      )}
                      value={licenseWizard.licenseKey}
                      placeholder={t('admin.config.quickWizard.fields.licenseInputPlaceholder')}
                      onChange={(event) => licenseWizard.onLicenseKeyChange(event.target.value)}
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      className="h-9 px-4 rounded-lg border border-primary bg-primary text-white text-sm sm:text-sm font-black disabled:opacity-40 shadow-lg shadow-primary/20 transition-all hover:opacity-90"
                      onClick={licenseWizard.onApplyLicense}
                      disabled={licenseWizard.saving || licenseWizard.licenseKey.trim().length === 0}
                    >
                      {t('admin.config.quickWizard.actions.applyLicense')}
                    </button>
                  </div>
                </section>
              )}

              <div className="flex items-center justify-between gap-2 shrink-0">
                <button
                  type="button"
                  className={cn(
                    "h-10 px-6 rounded-lg border text-sm sm:text-sm font-black transition-all disabled:opacity-40 shadow-sm",
                    isDark ? "border-white/15 bg-white/5 text-slate-300 hover:bg-white/10" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  )}
                  onClick={() => {
                    if (currentStepIndex > 0) {
                      const previousStep = friendlySteps[currentStepIndex - 1];
                      if (previousStep) {
                        setFriendlyStep(previousStep);
                      }
                    }
                  }}
                  disabled={currentStepIndex <= 0}
                >
                  {t('admin.config.quickWizard.actions.previous')}
                </button>
                <button
                  type="button"
                  className="h-10 px-8 rounded-lg border border-primary bg-primary text-white text-sm sm:text-sm font-black disabled:opacity-40 shadow-lg shadow-primary/20 transition-all hover:opacity-90"
                  onClick={() => {
                    if (currentStepIndex < friendlySteps.length - 1) {
                      const nextStep = friendlySteps[currentStepIndex + 1];
                      if (nextStep) {
                        setFriendlyStep(nextStep);
                      }
                    } else {
                      onClose();
                    }
                  }}
                >
                  {currentStepIndex < friendlySteps.length - 1
                    ? t('admin.config.quickWizard.actions.next')
                    : t('admin.config.quickWizard.actions.done')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {onResetAdminPassword && (
        <AdminPasswordPanel
          mode="modal"
          isOpen={showAdminPasswordPanel}
          onClose={() => setShowAdminPasswordPanel(false)}
          onConfirm={onResetAdminPassword}
          loading={isResettingAdminPassword}
          showWarning={true}
          showRandomGenerator={true}
          minPasswordLength={8}
          zIndex={140}
        />
      )}

      {licenseWizard && (
        <LicenseManagementModal
          isOpen={isLicenseModalOpen}
          onClose={() => setIsLicenseModalOpen(false)}
          isValid={licenseWizard.isValid}
          currentUsers={licenseWizard.currentUsers}
          maxUsers={licenseWizard.maxUsers}
          deviceCode={licenseWizard.deviceCode}
          licenseKey={licenseWizard.licenseKey}
          saving={licenseWizard.saving}
          onLicenseKeyChange={licenseWizard.onLicenseKeyChange}
          onApplyLicense={licenseWizard.onApplyLicense}
        />
      )}
    </div>
  );

  if (typeof document === 'undefined') {
    return null;
  }

  return createPortal(modalContent, document.body);
};
