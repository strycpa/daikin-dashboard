"use client";

import { useState } from "react";
import { Button } from "@/components/ui/controls";

interface AuthConnectPanelProps {
  demoMode: boolean;
  redirectUri: string;
  manualOAuth: boolean;
  onConnected: () => void;
  onError: (message: string) => void;
}

export function AuthConnectPanel({
  demoMode,
  redirectUri,
  manualOAuth,
  onConnected,
  onError,
}: AuthConnectPanelProps) {
  const [codeInput, setCodeInput] = useState("");
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const startOAuth = async () => {
    onError("");
    setBusy(true);

    try {
      const response = await fetch("/api/auth/url");
      const data = (await response.json()) as {
        url?: string;
        message?: string;
      };

      if (!data.url) {
        onConnected();
        return;
      }

      setAuthUrl(data.url);
      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch {
      onError("Nepodařilo se vytvořit přihlašovací URL.");
    } finally {
      setBusy(false);
    }
  };

  const submitCode = async () => {
    onError("");
    setBusy(true);

    try {
      const response = await fetch("/api/auth/exchange", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: codeInput }),
      });

      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Token exchange failed");
      }

      setCodeInput("");
      setAuthUrl(null);
      onConnected();
    } catch (error) {
      onError(error instanceof Error ? error.message : "Přihlášení selhalo");
    } finally {
      setBusy(false);
    }
  };

  if (demoMode) {
    return (
      <section className="rounded-2xl border border-dashed border-slate-600 bg-slate-900/40 p-8 text-center">
        <h2 className="text-lg font-semibold text-white">Demo režim</h2>
        <p className="mx-auto mt-2 max-w-lg text-sm text-slate-400">
          Bez <code className="text-teal-300">DAIKIN_CLIENT_ID</code> běží ukázkových
          5 jednotek. Doplň credentials v <code className="text-teal-300">.env</code>{" "}
          pro reálné připojení.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-700/70 bg-slate-900/50 p-6 sm:p-8">
      <h2 className="text-lg font-semibold text-white">Připojení k Daikin cloudu</h2>
      <p className="mt-2 max-w-2xl text-sm text-slate-400">
        Redirect URI v Daikin portálu:{" "}
        <code className="text-teal-300">{redirectUri}</code>
      </p>

      {manualOAuth && (
        <div className="mt-4 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100/90">
          Daikin portál neukládá <code className="text-amber-50">http://</code> — po
          souhlasu se stránka „zasekne“ a v konzoli prohlížeče uvidíš řádek{" "}
          <code className="text-amber-50">Failed to launch &apos;localhost:3000/...&apos;</code>.
          Zkopíruj celou tu URL (nebo jen hodnotu <code className="text-amber-50">code=</code>)
          a vlož ji níže.
        </div>
      )}

      <ol className="mt-6 space-y-4 text-sm text-slate-300">
        <li className="flex gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-500/20 text-xs font-semibold text-teal-300">
            1
          </span>
          <div className="flex flex-1 flex-wrap items-center gap-3">
            <span>Otevři Daikin přihlášení</span>
            <Button disabled={busy} onClick={() => void startOAuth()}>
              Přihlásit u Daikin
            </Button>
            {authUrl && (
              <a
                href={authUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-teal-400 underline"
              >
                odkaz znovu
              </a>
            )}
          </div>
        </li>

        {manualOAuth && (
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-500/20 text-xs font-semibold text-teal-300">
              2
            </span>
            <span>
              Po souhlasu zkopíruj z konzole (F12 → Console) celou URL začínající{" "}
              <code className="text-teal-300">localhost:3000/api/auth/callback?code=</code>
            </span>
          </li>
        )}

        <li className="flex gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-500/20 text-xs font-semibold text-teal-300">
            {manualOAuth ? "3" : "2"}
          </span>
          <div className="flex w-full flex-col gap-3">
            <span>
              {manualOAuth
                ? "Vlož callback URL nebo samotný authorization code"
                : "Po přesměrování by mělo přihlášení proběhnout automaticky"}
            </span>
            {manualOAuth && (
              <>
                <textarea
                  value={codeInput}
                  onChange={(event) => setCodeInput(event.target.value)}
                  placeholder="localhost:3000/api/auth/callback?code=st2.s....&state=..."
                  rows={4}
                  className="w-full rounded-xl border border-slate-600 bg-slate-950/80 px-3 py-2 font-mono text-xs text-slate-100 outline-none focus:border-teal-400/50"
                />
                <Button
                  disabled={busy || !codeInput.trim()}
                  onClick={() => void submitCode()}
                >
                  Dokončit přihlášení
                </Button>
              </>
            )}
          </div>
        </li>
      </ol>
    </section>
  );
}
