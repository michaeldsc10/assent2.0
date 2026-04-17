/* ═══════════════════════════════════════════════════
   ASSENT v2.0 — TabelaRelatorio.jsx
   Tabela reutilizável para relatórios
   Props:
     columns  – [{ key, label, align?, render? }]
     data     – array of objects
     empty    – string (msg quando vazio)
     loading  – boolean
     title    – string (opcional, cabeçalho da tabela)
     count    – number (opcional, badge de contagem)
   ═══════════════════════════════════════════════════ */

export default function TabelaRelatorio({
  columns = [],
  data = [],
  empty = "Nenhum dado encontrado.",
  loading = false,
  title,
  count,
}) {
  const gridCols = columns.map(() => "1fr").join(" ");

  return (
    <div className="tr-wrap">
      {(title || count !== undefined) && (
        <div className="tr-header">
          {title && <span className="tr-title">{title}</span>}
          {count !== undefined && (
            <span className="tr-badge">{count}</span>
          )}
        </div>
      )}

      {/* Cabeçalho das colunas */}
      <div className="tr-head" style={{ gridTemplateColumns: gridCols }}>
        {columns.map((col) => (
          <span
            key={col.key}
            style={{ textAlign: col.align || "left" }}
          >
            {col.label}
          </span>
        ))}
      </div>

      {/* Corpo */}
      {loading ? (
        <div className="tr-state">Carregando...</div>
      ) : data.length === 0 ? (
        <div className="tr-state">{empty}</div>
      ) : (
        data.map((row, i) => (
          <div
            key={row.id || i}
            className="tr-row"
            style={{ gridTemplateColumns: gridCols }}
          >
            {columns.map((col) => (
              <span
                key={col.key}
                style={{ textAlign: col.align || "left" }}
                className={col.className || ""}
              >
                {col.render
                  ? col.render(row[col.key], row, i)
                  : (row[col.key] ?? "—")}
              </span>
            ))}
          </div>
        ))
      )}
    </div>
  );
}
