"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { DaikinSite, DevicesMeta, OperationMode, UnitStatus } from "@/lib/daikin/types";
import {
  averageRoomTemp,
  countPoweredOn,
  formatTemperature,
} from "@/lib/utils";
import { AuthConnectPanel } from "@/components/AuthConnectPanel";
import { MasterPanel } from "@/components/MasterPanel";
import { UnitCard } from "@/components/UnitCard";
import { Button } from "@/components/ui/controls";

interface AuthStatus {
  authenticated: boolean;
  demoMode: boolean;
  expiresAt: number | null;
  redirectUri?: string;
  manualOAuth?: boolean;
  usesOAuthProxy?: boolean;
  householdId?: string;
  tokenBackend?: "firestore" | "file";
}

export function Dashboard() {
  const [sites, setSites] = useState<DaikinSite[]>([]);
  const [siteId, setSiteId] = useState<string | null>(null);
  const [units, setUnits] = useState<UnitStatus[]>([]);
  const [devicesMeta, setDevicesMeta] = useState<DevicesMeta | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [auth, setAuth] = useState<AuthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [draftSetpoint, setDraftSetpoint] = useState(22);
  const [draftFan, setDraftFan] = useState(3);
  const [draftMode, setDraftMode] = useState<OperationMode>("cooling");

  const loadAuth = useCallback(async () => {
    const response = await fetch("/api/auth/status");
    const data = (await response.json()) as AuthStatus;
    setAuth(data);
    return data;
  }, []);

  const loadSites = useCallback(async () => {
    const response = await fetch("/api/sites");
    const data = (await response.json()) as {
      sites?: DaikinSite[];
      error?: string;
    };

    if (data.error) {
      throw new Error(data.error);
    }

    const nextSites = data.sites ?? [];
    setSites(nextSites);

    if (!siteId && nextSites.length > 0) {
      setSiteId(nextSites[0].id);
    }

    return nextSites;
  }, [siteId]);

  const loadUnits = useCallback(async (activeSiteId: string | null) => {
    const query = activeSiteId ? `?siteId=${encodeURIComponent(activeSiteId)}` : "";
    const response = await fetch(`/api/devices${query}`);
    const data = (await response.json()) as {
      units?: UnitStatus[];
      meta?: DevicesMeta;
      error?: string;
    };

    if (!response.ok) {
      throw new Error(data.error ?? "Failed to load units");
    }

    const nextUnits = data.units ?? [];
    setUnits(nextUnits);
    setDevicesMeta(data.meta ?? null);
    setSelectedIds((current) => {
      const valid = new Set(nextUnits.map((unit) => unit.id));
      return new Set([...current].filter((id) => valid.has(id)));
    });

    return nextUnits;
  }, []);

  const refreshData = useCallback(async () => {
    setError(null);
    setLoading(true);

    try {
      const authStatus = await loadAuth();
      if (!authStatus.authenticated) {
        setUnits([]);
        return;
      }

      await loadSites();
      await loadUnits(siteId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Refresh failed");
    } finally {
      setLoading(false);
    }
  }, [loadAuth, loadSites, loadUnits, siteId]);

  const startDaikinReauth = useCallback(async () => {
    setError(null);
    setBusy(true);

    try {
      const response = await fetch("/api/auth/url");
      const data = (await response.json()) as {
        url?: string;
        message?: string;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? data.message ?? "Nepodařilo se vytvořit OAuth URL");
      }

      if (!data.url) {
        await refreshData();
        return;
      }

      window.location.assign(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Přesměrování na Daikin selhalo");
      setBusy(false);
    }
  }, [refreshData]);

  const handleRefreshClick = useCallback(async () => {
    if (auth?.demoMode) {
      await refreshData();
      return;
    }

    await startDaikinReauth();
  }, [auth?.demoMode, refreshData, startDaikinReauth]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!cancelled) {
        await refreshData();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [refreshData]);

  useEffect(() => {
    if (!auth?.authenticated) {
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        await loadUnits(siteId);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load units");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [auth?.authenticated, loadUnits, siteId]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authResult = params.get("auth");
    const message = params.get("message");

    if (authResult === "success") {
      window.history.replaceState({}, "", "/");

      let cancelled = false;
      void (async () => {
        const status = await loadAuth();
        if (cancelled) {
          return;
        }

        const household = status.householdId ?? "Strejdomov";
        setNotice(
          status.tokenBackend === "firestore"
            ? `Připojeno k Daikin cloudu. Token uložen do Firestore pro domácnost „${household}".`
            : "Připojeno k Daikin cloudu.",
        );
        await refreshData();
      })();

      return () => {
        cancelled = true;
      };
    }

    if (authResult === "error") {
      // Surface the OAuth error carried in the URL into UI state on mount. This is a
      // one-shot synchronization of external (redirect) state with no async work to
      // await, so the synchronous setState here is intentional.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError(message ?? "OAuth selhalo");
      window.history.replaceState({}, "", "/");
    }
  }, [loadAuth, refreshData]);

  const handleAuthConnected = async () => {
    const status = await loadAuth();
    const household = status.householdId ?? "Strejdomov";
    setNotice(
      status.tokenBackend === "firestore"
        ? `Připojeno k Daikin cloudu. Token uložen do Firestore pro domácnost „${household}".`
        : "Připojeno k Daikin cloudu.",
    );
    setError(null);
    await refreshData();
  };

  const postControl = async (
    payload: Record<string, unknown>,
  ): Promise<void> => {
    setBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId, ...payload }),
      });

      const data = (await response.json()) as {
        error?: string;
        failed?: { id: string; error: string }[];
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Control failed");
      }

      if (data.failed && data.failed.length > 0) {
        setError(
          `Některé jednotky selhaly: ${data.failed.map((item) => item.error).join(", ")}`,
        );
      }

      await loadUnits(siteId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Control failed");
    } finally {
      setBusy(false);
    }
  };

  const handleUnitControl = async (
    deviceId: string,
    changes: {
      power?: "on" | "off";
      mode?: OperationMode;
      setpointC?: number;
      fanSpeed?: number;
    },
  ) => {
    await postControl({ deviceId, ...changes });
  };

  const handleMasterApply = async (changes: {
    power?: "on" | "off";
    mode?: OperationMode;
    setpointC?: number;
    fanSpeed?: number;
  }) => {
    if (selectedIds.size === 0) {
      return;
    }

    await postControl({
      deviceIds: [...selectedIds],
      ...changes,
    });
  };

  const stats = useMemo(
    () => ({
      avgTemp: averageRoomTemp(units),
      poweredOn: countPoweredOn(units),
    }),
    [units],
  );

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-teal-400/70">
            Daikin Comfora
          </p>
          <h1 className="bg-gradient-to-r from-white via-teal-100 to-cyan-300 bg-clip-text text-3xl font-bold text-transparent sm:text-4xl">
            Climate Dashboard
          </h1>
          <p className="mt-2 max-w-xl text-sm text-slate-400">
            Ovládání všech jednotek z jednoho místa přes Onecta cloud API.
            {auth?.householdId && !auth.demoMode && (
              <span className="mt-1 block text-xs text-slate-500">
                Domácnost: {auth.householdId}
              </span>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {sites.length > 1 && (
            <select
              value={siteId ?? ""}
              onChange={(event) => setSiteId(event.target.value || null)}
              className="rounded-xl border border-slate-600 bg-slate-900/70 px-3 py-2 text-sm text-slate-100"
            >
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name ?? site.id}
                </option>
              ))}
            </select>
          )}

          <Button
            variant="secondary"
            onClick={() => void handleRefreshClick()}
            disabled={loading || busy}
          >
            {loading || busy ? "Načítám…" : "Obnovit"}
          </Button>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Jednotky" value={String(units.length)} />
        <StatCard label="Zapnuto" value={String(stats.poweredOn)} accent="text-teal-300" />
        <StatCard
          label="Průměr v místnosti"
          value={formatTemperature(stats.avgTemp)}
        />
        <StatCard
          label="Stav API"
          value={auth?.demoMode ? "Demo" : auth?.authenticated ? "Online" : "Nepřipojeno"}
          accent={auth?.authenticated ? "text-teal-300" : "text-amber-300"}
        />
      </section>

      {notice && (
        <Banner tone="info" onDismiss={() => setNotice(null)}>
          {notice}
        </Banner>
      )}

      {error && (
        <Banner tone="error" onDismiss={() => setError(null)}>
          {error}
        </Banner>
      )}

      {!auth?.authenticated && !loading && auth && (
        <AuthConnectPanel
          demoMode={auth.demoMode}
          redirectUri={auth.redirectUri ?? "localhost:3000/api/auth/callback"}
          manualOAuth={auth.manualOAuth ?? true}
          usesOAuthProxy={auth.usesOAuthProxy ?? false}
          onConnected={() => void handleAuthConnected()}
          onError={(message) => setError(message || null)}
        />
      )}

      {auth?.authenticated && (
        <>
          {devicesMeta?.accountHint && units.length === 0 && !auth.demoMode && (
            <section className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-5 py-4 text-sm text-amber-100">
              <p className="font-medium text-amber-50">Žádné jednotky z API</p>
              <p className="mt-2">{devicesMeta.accountHint}</p>
              <p className="mt-3 font-mono text-xs text-amber-200/80">
                API: {devicesMeta.rawGatewayCount} gateway zařízení ·{" "}
                {devicesMeta.rawSiteCount} site
                {devicesMeta.siteFilterActive ? " · aktivní filtr site" : ""}
              </p>
              <ul className="mt-3 list-inside list-disc space-y-1 text-amber-100/90">
                <li>
                  Developer Portal i OAuth login musí být stejný účet jako Onecta
                  appka s klimatizacemi
                </li>
                <li>
                  Stejný způsob přihlášení (e-mail / Google / Apple) — jiná
                  kombinace = prázdný seznam
                </li>
                <li>
                  Po opravě klikni na <strong>Obnovit</strong> a přihlas se znovu u
                  Daikin
                </li>
              </ul>
            </section>
          )}

          <MasterPanel
            units={units}
            selectedIds={selectedIds}
            busy={busy}
            draftSetpoint={draftSetpoint}
            draftFan={draftFan}
            draftMode={draftMode}
            onDraftSetpointChange={setDraftSetpoint}
            onDraftFanChange={setDraftFan}
            onDraftModeChange={setDraftMode}
            onSelectAll={(selected) => {
              setSelectedIds(
                selected ? new Set(units.map((unit) => unit.id)) : new Set(),
              );
            }}
            onApply={handleMasterApply}
          />

          <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {units.map((unit) => (
              <UnitCard
                key={unit.id}
                unit={unit}
                busy={busy}
                selected={selectedIds.has(unit.id)}
                onSelectChange={(selected) => {
                  setSelectedIds((current) => {
                    const next = new Set(current);
                    if (selected) {
                      next.add(unit.id);
                    } else {
                      next.delete(unit.id);
                    }
                    return next;
                  });
                }}
                onControl={(changes) => handleUnitControl(unit.id, changes)}
              />
            ))}

            {units.length < 6 && (
              <div className="hidden rounded-2xl border border-dashed border-slate-700/70 bg-slate-900/20 xl:flex xl:min-h-[420px] xl:items-center xl:justify-center">
                <p className="text-sm text-slate-500">
                  {units.length}/5 jednotek · volný slot
                </p>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  accent = "text-white",
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-900/50 px-4 py-3">
      <p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`mt-1 font-mono text-lg font-semibold ${accent}`}>{value}</p>
    </div>
  );
}

function Banner({
  tone,
  children,
  onDismiss,
}: {
  tone: "info" | "error";
  children: React.ReactNode;
  onDismiss: () => void;
}) {
  return (
    <div
      className={
        tone === "error"
          ? "rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200"
          : "rounded-xl border border-teal-500/30 bg-teal-500/10 px-4 py-3 text-sm text-teal-100"
      }
    >
      <div className="flex items-start justify-between gap-3">
        <span>{children}</span>
        <button
          type="button"
          onClick={onDismiss}
          className="text-xs uppercase tracking-wide opacity-70 hover:opacity-100"
        >
          Zavřít
        </button>
      </div>
    </div>
  );
}
