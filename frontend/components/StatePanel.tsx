interface Props { tone: "loading" | "error" | "disconnected" | "empty"; title: string; detail?: string; }
export function StatePanel({ tone, title, detail }: Props) {
  const alert = tone === "error" || tone === "disconnected";
  return (
    <div role={alert ? "alert" : "status"} className="rounded-card border border-line bg-coal p-6">
      <p className={`text-sm font-medium ${alert ? "text-peach" : "text-bone"}`}>{title}</p>
      {detail && <p className="mt-1 text-sm text-fog">{detail}</p>}
    </div>
  );
}
