import React, { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { ExternalLinkButton } from "@fileuni/ts-shared/external-link";
import { cn } from "@/lib/utils";
import { useResolvedTheme } from "@/hooks/useResolvedTheme";
import {
  ensureRecord,
  isRecord,
  type ConfigObject,
} from "@/lib/configObject";
import { openExternalUrl } from "@/platform/external-link";
import type { TomlAdapter } from "./ExternalDependencyConfigModal";
import { useConfigDraftBinding } from "./useConfigDraftBinding";

export type ZeroTierProtocolKind =
  | "web"
  | "api"
  | "web_dav"
  | "s3"
  | "sftp"
  | "ftp";

export type ZeroTierExposurePlanItem = {
  protocol: ZeroTierProtocolKind;
  enabled: boolean;
  supported: boolean;
  target_host: string;
  target_port: number;
  path_hint?: string | null;
  reason?: string | null;
};

export type ZeroTierSupportMatrixItem = {
  protocol: ZeroTierProtocolKind;
  supported: boolean;
  reason?: string | null;
};

export type ZeroTierRuntimeState =
  | "disabled"
  | "action_required"
  | "waiting_config"
  | "reconnect_pending"
  | "joining"
  | "waiting_assigned_ip"
  | "ready"
  | "error";

export type ZeroTierRuntimeSnapshot = {
  enabled: boolean;
  configured: boolean;
  started: boolean;
  online: boolean;
  joined: boolean;
  runtime_state: ZeroTierRuntimeState;
  node_id?: string | null;
  network_id?: string | null;
  assigned_ip?: string | null;
  last_error?: string | null;
  plan: ZeroTierExposurePlanItem[];
};

export type ZeroTierGenerateKeypairResponse = {
  identity_public: string;
  identity_secret: string;
  node_id: string;
};

type Draft = {
  enabled: boolean;
  adminApiEnabled: boolean;
  networkId: string;
  autoJoin: boolean;
  identityPublic: string;
  identitySecret: string;
};
type Props = {
  tomlAdapter: TomlAdapter;
  content: string;
  onContentChange: (value: string) => void;
  runtimeSnapshot: ZeroTierRuntimeSnapshot | null;
  adminApiAvailable: boolean;
  actionPending: boolean;
  generatingKeypair: boolean;
  onJoinNow: () => void;
  onDisconnect: () => void;
  onReconnect: () => void;
  onGenerateKeypair: () => void;
};

const defaultDraft: Draft = {
  enabled: false,
  adminApiEnabled: true,
  networkId: "0000000000000000",
  autoJoin: true,
  identityPublic: "",
  identitySecret: "",
};
const asRecord = (value: unknown): ConfigObject => {
  return isRecord(value) ? value : {};
};

const toStringValue = (value: unknown, fallback: string): string => {
  return typeof value === "string" ? value : fallback;
};

const toBooleanValue = (value: unknown, fallback: boolean): boolean => {
  return typeof value === "boolean" ? value : fallback;
};

const parseDraft = (source: string, tomlAdapter: TomlAdapter): Draft => {
  const parsed = tomlAdapter.parse(source);
  const root = asRecord(parsed);
  const zerotier = asRecord(root["zerotier_embedded"]);

  return {
    enabled: toBooleanValue(zerotier["enabled"], defaultDraft.enabled),
    adminApiEnabled: toBooleanValue(
      zerotier["admin_api_enabled"],
      defaultDraft.adminApiEnabled,
    ),
    networkId: toStringValue(zerotier["network_id"], defaultDraft.networkId),
    autoJoin: toBooleanValue(zerotier["auto_join"], defaultDraft.autoJoin),
    identityPublic: toStringValue(
      zerotier["identity_public"],
      defaultDraft.identityPublic,
    ),
    identitySecret: toStringValue(
      zerotier["identity_secret"],
      defaultDraft.identitySecret,
    ),
  };
};

const applyDraft = (
  source: string,
  tomlAdapter: TomlAdapter,
  draft: Draft,
): string => {
  const parsed = tomlAdapter.parse(source);
  const root = asRecord(parsed);
  const zerotier = ensureRecord(root, "zerotier_embedded");

  zerotier["enabled"] = draft.enabled;
  zerotier["admin_api_enabled"] = draft.adminApiEnabled;
  zerotier["network_id"] = draft.networkId;
  zerotier["auto_join"] = draft.enabled ? true : draft.autoJoin;
  zerotier["identity_public"] = draft.identityPublic;
  zerotier["identity_secret"] = draft.identitySecret;
  delete zerotier["expose_web"];
  delete zerotier["expose_api"];
  delete zerotier["expose_webdav"];
  delete zerotier["expose_s3"];
  delete zerotier["expose_sftp"];
  delete zerotier["expose_ftp"];

  return tomlAdapter.stringify(root);
};

const Section: React.FC<{
  title: string;
  hint?: string;
  isDark: boolean;
  children: React.ReactNode;
}> = ({ title, hint, isDark, children }) => {
  return (
    <section
      className={cn(
        "rounded-2xl border p-4 space-y-4",
        isDark ? "border-white/10 bg-white/[0.03]" : "border-slate-200 bg-white",
      )}
    >
      <div>
        <div
          className={cn(
            "text-xs font-black tracking-wide",
            isDark ? "text-slate-400" : "text-slate-700",
          )}
        >
          {title}
        </div>
        {hint ? (
          <div
            className={cn(
              "mt-2 text-sm leading-6",
              isDark ? "text-slate-400" : "text-slate-600",
            )}
          >
            {hint}
          </div>
        ) : null}
      </div>
      {children}
    </section>
  );
};

const Label: React.FC<{ text: string; isDark: boolean }> = ({ text, isDark }) => {
  return (
    <div
      className={cn(
        "text-xs font-black tracking-wide",
        isDark ? "text-slate-400" : "text-slate-700",
      )}
    >
      {text}
    </div>
  );
};

const boolText = (
  value: boolean,
  enabledLabel: string,
  disabledLabel: string,
): string => {
  return value ? enabledLabel : disabledLabel;
};

const getRuntimeStateText = (
  state: ZeroTierRuntimeState | undefined,
  t: (key: string) => string,
): string => {
  switch (state) {
    case "disabled":
    case "action_required":
    case "waiting_config":
    case "error":
      return t("admin.config.zerotierEmbedded.runtimeStates.disabled");
    case "reconnect_pending":
      return t("admin.config.zerotierEmbedded.runtimeStates.reconnectPending");
    case "joining":
    case "waiting_assigned_ip":
      return t("admin.config.zerotierEmbedded.runtimeStates.joining");
    case "ready":
      return t("admin.config.zerotierEmbedded.runtimeStates.ready");
    default:
      return "-";
  }
};

export const ZeroTierEmbeddedInlinePanel: React.FC<Props> = ({
  tomlAdapter,
  content,
  onContentChange,
  runtimeSnapshot,
  adminApiAvailable,
  actionPending,
  generatingKeypair,
  onJoinNow,
  onDisconnect,
  onReconnect,
  onGenerateKeypair,
}) => {
  const { t } = useTranslation();
  const isDark = useResolvedTheme() === "dark";

  const createDraft = useCallback(
    (source: string) => parseDraft(source, tomlAdapter),
    [tomlAdapter],
  );
  const buildContent = useCallback(
    (source: string, draft: Draft) => applyDraft(source, tomlAdapter, draft),
    [tomlAdapter],
  );
  const { draft, setDraft } = useConfigDraftBinding<Draft>({
    content,
    onContentChange,
    createDraft,
    buildContent,
  });

  const inputClass = cn(
    "mt-2 h-11 w-full rounded-xl border px-3 text-sm font-mono",
    isDark
      ? "border-white/10 bg-black/30 text-white"
      : "border-slate-300 bg-white text-slate-900",
  );

  const toggleClass = cn(
    "flex items-center gap-3 rounded-xl border border-dashed p-3",
    isDark ? "border-white/10" : "border-slate-300/70",
  );

  const actionButtonClass = cn(
    "inline-flex h-10 items-center justify-center rounded-2xl border px-4 text-sm font-black transition-colors disabled:cursor-not-allowed disabled:opacity-50",
    isDark
      ? "border-white/10 bg-white/[0.03] text-slate-100 hover:bg-white/10"
      : "border-slate-200 bg-white text-slate-800 hover:bg-slate-100",
  );

  const runtimeState = runtimeSnapshot?.runtime_state;
  const isDisconnectedState =
    runtimeState === undefined ||
    runtimeState === "disabled" ||
    runtimeState === "action_required" ||
    runtimeState === "waiting_config" ||
    runtimeState === "error";
  const isConnectingState =
    runtimeState === "joining" || runtimeState === "waiting_assigned_ip";
  const isRetryingState = runtimeState === "reconnect_pending";
  const isConnectedState = runtimeState === "ready";
  const canJoinNow =
    adminApiAvailable &&
    !actionPending &&
    isDisconnectedState;
  const canDisconnect =
    adminApiAvailable &&
    !actionPending &&
    (isConnectingState || isRetryingState || isConnectedState);
  const canReconnect =
    adminApiAvailable &&
    !actionPending &&
    (runtimeSnapshot?.configured ?? false);

  const summaryStats = [
    {
      label: t("admin.config.zerotierEmbedded.stats.enabled"),
      value: boolText(
        runtimeSnapshot?.enabled ?? draft.enabled,
        t("admin.config.zerotierEmbedded.status.enabled"),
        t("admin.config.zerotierEmbedded.status.disabled"),
      ),
    },
    {
      label: t("admin.config.zerotierEmbedded.stats.runtimeState"),
      value: getRuntimeStateText(runtimeSnapshot?.runtime_state, t),
    },
    {
      label: t("admin.config.zerotierEmbedded.stats.nodeId"),
      value:
        runtimeSnapshot?.node_id?.trim() || draft.identityPublic.slice(0, 10) || "-",
    },
    {
      label: t("admin.config.zerotierEmbedded.stats.assignedIp"),
      value: runtimeSnapshot?.assigned_ip?.trim() || "-",
    },
  ];

  return (
    <div className="space-y-4">
      <Section
        title={t("admin.config.zerotierEmbedded.configTitle")}
        hint={t("admin.config.zerotierEmbedded.configHint")}
        isDark={isDark}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <label className={toggleClass}>
            <input
              type="checkbox"
              checked={draft.enabled}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, enabled: event.target.checked }))
              }
              className="h-4 w-4 rounded border-slate-300"
            />
            <span className={cn("text-sm font-bold", isDark ? "text-slate-200" : "text-slate-700")}>
              {t("admin.config.zerotierEmbedded.enabled")}
            </span>
          </label>
          <label className={toggleClass}>
            <input
              type="checkbox"
              checked={draft.adminApiEnabled}
              onChange={(event) =>
                setDraft((prev) => ({
                  ...prev,
                  adminApiEnabled: event.target.checked,
                }))
              }
              className="h-4 w-4 rounded border-slate-300"
            />
            <span className={cn("text-sm font-bold", isDark ? "text-slate-200" : "text-slate-700")}>
              {t("admin.config.zerotierEmbedded.adminApiEnabled")}
            </span>
          </label>
          <label className={toggleClass}>
            <input
              type="checkbox"
              checked={draft.enabled ? true : draft.autoJoin}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, autoJoin: event.target.checked }))
              }
              disabled={draft.enabled}
              className="h-4 w-4 rounded border-slate-300"
            />
            <span className={cn("text-sm font-bold", isDark ? "text-slate-200" : "text-slate-700")}>
              {t("admin.config.zerotierEmbedded.autoJoin")}
            </span>
          </label>
        </div>

        <div className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-2">
            <div className="xl:col-span-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Label text={t("admin.config.zerotierEmbedded.networkId")} isDark={isDark} />
                <ExternalLinkButton
                  href="https://my.zerotier.com/"
                  onOpen={openExternalUrl}
                  className="w-full sm:w-auto"
                  title="Open ZeroTier Central"
                >
                  ZeroTier Central
                </ExternalLinkButton>
              </div>
              <input
                value={draft.networkId}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, networkId: event.target.value }))
                }
                className={inputClass}
                placeholder={t("admin.config.zerotierEmbedded.networkIdPlaceholder")}
              />
            </div>
            <div>
              <Label text={t("admin.config.zerotierEmbedded.identityPublic")} isDark={isDark} />
              <input
                value={draft.identityPublic}
                onChange={(event) =>
                  setDraft((prev) => ({
                    ...prev,
                    identityPublic: event.target.value,
                  }))
                }
                className={inputClass}
              />
            </div>
            <div>
              <Label text={t("admin.config.zerotierEmbedded.identitySecret")} isDark={isDark} />
              <input
                value={draft.identitySecret}
                onChange={(event) =>
                  setDraft((prev) => ({
                    ...prev,
                    identitySecret: event.target.value,
                  }))
                }
                className={inputClass}
              />
            </div>
          </div>

          <div className="flex justify-start sm:justify-end">
            <button
              type="button"
              onClick={onGenerateKeypair}
              disabled={generatingKeypair}
              className={cn(actionButtonClass, "w-full sm:w-auto")}
            >
              {generatingKeypair
                ? t("admin.config.zerotierEmbedded.generatingKeypair")
                : t("admin.config.zerotierEmbedded.generateKeypair")}
            </button>
          </div>
        </div>
      </Section>

      <Section
        title={t("admin.config.zerotierEmbedded.runtimeTitle")}
        hint={t("admin.config.zerotierEmbedded.runtimeHint")}
        isDark={isDark}
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {summaryStats.map((stat) => (
            <div
              key={stat.label}
              className={cn(
                "rounded-2xl border px-3 py-3",
                isDark ? "border-white/10 bg-black/20" : "border-slate-200 bg-slate-50",
              )}
            >
              <div className={cn("text-[11px] font-black tracking-[0.18em]", isDark ? "text-slate-400" : "text-slate-500")}>
                {stat.label}
              </div>
              <div className={cn("mt-2 text-sm break-all", isDark ? "text-slate-100" : "text-slate-800")}>
                {stat.value}
              </div>
            </div>
          ))}
        </div>
        {!adminApiAvailable ? (
          <div
            className={cn(
              "rounded-xl border p-3 text-sm leading-6",
              isDark
                ? "border-slate-500/30 bg-slate-500/10 text-slate-200"
                : "border-slate-200 bg-slate-50 text-slate-700",
            )}
          >
            {t("admin.config.zerotierEmbedded.adminApiUnavailable")}
          </div>
        ) : null}
        {runtimeSnapshot?.last_error ? (
          <div
            className={cn(
              "rounded-xl border p-3 text-sm leading-6",
              isDark
                ? "border-amber-500/30 bg-amber-500/10 text-amber-100"
                : "border-amber-200 bg-amber-50 text-amber-900",
            )}
          >
            {runtimeSnapshot.last_error}
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onJoinNow}
            disabled={!canJoinNow}
            className={actionButtonClass}
          >
            {t("admin.config.zerotierEmbedded.joinNow")}
          </button>
          <button
            type="button"
            onClick={onDisconnect}
            disabled={!canDisconnect}
            className={actionButtonClass}
          >
            {t("admin.config.zerotierEmbedded.disconnect")}
          </button>
          <button
            type="button"
            onClick={onReconnect}
            disabled={!canReconnect}
            className={actionButtonClass}
          >
            {t("admin.config.zerotierEmbedded.reconnect")}
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className={cn("text-sm leading-6", isDark ? "text-slate-400" : "text-slate-600")}>
            {t("admin.config.zerotierEmbedded.restartHint")}
          </div>
        </div>
      </Section>
    </div>
  );
};
