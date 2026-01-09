"use client";
export default function CrossOwner({ ui }: { ui: any }) {
  const c7 = Array.isArray(ui?.cross_brain_actions_7d) ? ui.cross_brain_actions_7d : [];
  const c30 = Array.isArray(ui?.cross_brain_actions_30d) ? ui.cross_brain_actions_30d : [];
  const owners = ui?.owner_matrix ?? {};
  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div>
        <h3 className="font-semibold mb-2">Cross-Brain (7-Day)</h3>
        {c7.length ? (
          <ul className="list-disc pl-5 space-y-1">
            {c7.map((x: any, i: number) => <li key={i}>{typeof x === "string" ? x : JSON.stringify(x)}</li>)}
          </ul>
        ) : <div className="opacity-60">—</div>}
        {c30.length > 0 && (
          <>
            <h3 className="font-semibold mt-4 mb-2">Cross-Brain (30-Day)</h3>
            <ul className="list-disc pl-5 space-y-1">
              {c30.map((x: any, i: number) => <li key={i}>{typeof x === "string" ? x : JSON.stringify(x)}</li>)}
            </ul>
          </>
        )}
      </div>
      <div>
        <h3 className="font-semibold mb-2">Owner Matrix</h3>
        {Object.keys(owners).length === 0 ? <div className="opacity-60">—</div> :
          Object.entries(owners).map(([k, v]: any) => (
            <div key={k} className="mb-3">
              <div className="font-medium">{k}</div>
              <ul className="list-disc pl-5">
                {(Array.isArray(v) ? v : [v]).map((t: any, i: number) => <li key={i}>{String(t)}</li>)}
              </ul>
            </div>
          ))}
      </div>
    </div>
  );
}
