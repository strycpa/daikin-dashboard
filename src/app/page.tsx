import { Dashboard } from "@/components/Dashboard";

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-app-gradient">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-40" />
      <div className="pointer-events-none absolute -left-32 top-0 h-96 w-96 rounded-full bg-teal-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-32 bottom-0 h-96 w-96 rounded-full bg-cyan-500/10 blur-3xl" />
      <Dashboard />
    </main>
  );
}
