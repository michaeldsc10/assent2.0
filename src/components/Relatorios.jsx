// Relatorios.jsx
// Módulo de Relatórios com sub-relatórios bloqueados por cadeado conforme cargo.
// Cargos sem permissão VEEM o item mas não conseguem abrir — cadeado visual.
// Todos os cargos enxergam o menu Relatórios (o bloqueio é por sub-relatório).

import { useState, useContext } from "react";
import  AuthContext  from "../contexts/AuthContext";
import {
  Lock,
  BarChart2,
  TrendingUp,
  Receipt,
  ShoppingCart,
  Package,
  DollarSign,
  Users,
  Calendar,
  ChevronRight,
  ArrowLeft,
} from "lucide-react";

// ─── Mapa de permissões por sub-relatório ────────────────────────────────────
// Chave = id do sub-relatório
// Valor = array de cargos que têm acesso (além do Admin que sempre acessa tudo)
const PERMISSOES_RELATORIO = {
  dre:        ["financeiro"],
  financeiro: ["financeiro"],
  despesas:   ["financeiro"],
  compras:    ["financeiro", "compras"],
  estoque:    ["financeiro", "comercial", "compras", "operacional", "vendedor"],
  vendas:     ["financeiro", "comercial", "vendedor", "suporte"],
  clientes:   ["comercial", "vendedor", "suporte"],
  agenda:     ["comercial", "vendedor", "suporte"],
};

// ─── Definição dos sub-relatórios ────────────────────────────────────────────
const SUB_RELATORIOS = [
  {
    id: "dre",
    label: "DRE",
    descricao: "Demonstrativo de Resultado do Exercício",
    icone: BarChart2,
    cor: "#6366f1",
  },
  {
    id: "financeiro",
    label: "Financeiro",
    descricao: "Visão consolidada das finanças",
    icone: DollarSign,
    cor: "#10b981",
  },
  {
    id: "despesas",
    label: "Despesas",
    descricao: "Análise de despesas por categoria",
    icone: Receipt,
    cor: "#f59e0b",
  },
  {
    id: "compras",
    label: "Compras",
    descricao: "Histórico e análise de compras",
    icone: ShoppingCart,
    cor: "#8b5cf6",
  },
  {
    id: "estoque",
    label: "Estoque",
    descricao: "Posição e movimentação do estoque",
    icone: Package,
    cor: "#3b82f6",
  },
  {
    id: "vendas",
    label: "Vendas",
    descricao: "Performance e histórico de vendas",
    icone: TrendingUp,
    cor: "#ec4899",
  },
  {
    id: "clientes",
    label: "Clientes",
    descricao: "Base de clientes e atividade",
    icone: Users,
    cor: "#14b8a6",
  },
  {
    id: "agenda",
    label: "Agenda",
    descricao: "Compromissos e histórico da agenda",
    icone: Calendar,
    cor: "#f97316",
  },
];

// ─── Hook de permissão local ──────────────────────────────────────────────────
function usePodeVerRelatorio(cargo, isAdmin) {
  return function temAcesso(idRelatorio) {
    if (isAdmin) return true;
    const permitidos = PERMISSOES_RELATORIO[idRelatorio] ?? [];
    return permitidos.includes(cargo);
  };
}

// ─── Placeholders de conteúdo dos relatórios ─────────────────────────────────
// Substitua por seus componentes reais.
function ConteudoRelatorio({ id, cargo, vendedorId }) {
  const avisoVendedor =
    id === "vendas" && cargo === "vendedor" ? (
      <div className="rel-aviso-vendedor">
        <TrendingUp size={16} />
        Exibindo apenas suas vendas (filtro por vendedorId aplicado no backend)
      </div>
    ) : null;

  return (
    <div className="rel-conteudo-placeholder">
      {avisoVendedor}
      <p>
        Conteúdo do relatório <strong>{id}</strong> — substitua por seu componente real.
      </p>
    </div>
  );
}

// ─── Card de sub-relatório ────────────────────────────────────────────────────
function CardRelatorio({ item, temAcesso, onClick }) {
  const Icone = item.icone;
  const bloqueado = !temAcesso;

  return (
    <button
      className={`rel-card ${bloqueado ? "rel-card--bloqueado" : ""}`}
      onClick={() => !bloqueado && onClick(item.id)}
      title={bloqueado ? "Seu perfil não tem acesso a este relatório" : item.descricao}
      aria-disabled={bloqueado}
    >
      <div className="rel-card__header">
        <span
          className="rel-card__icone-wrap"
          style={{ background: bloqueado ? "#e5e7eb" : `${item.cor}18`, color: bloqueado ? "#9ca3af" : item.cor }}
        >
          {bloqueado ? <Lock size={20} /> : <Icone size={20} />}
        </span>

        {bloqueado && (
          <span className="rel-card__badge-bloqueado">
            <Lock size={11} />
            Sem acesso
          </span>
        )}
      </div>

      <div className="rel-card__body">
        <span className="rel-card__label">{item.label}</span>
        <span className="rel-card__desc">{item.descricao}</span>
      </div>

      {!bloqueado && (
        <ChevronRight size={16} className="rel-card__seta" />
      )}
    </button>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function Relatorios() {
  const { cargo, isAdmin, vendedorId } = useContext(AuthContext);
  const [ativo, setAtivo] = useState(null); // id do sub-relatório aberto
  const temAcesso = usePodeVerRelatorio(cargo, isAdmin);

  // Encontra o item do sub-relatório aberto
  const itemAtivo = SUB_RELATORIOS.find((s) => s.id === ativo);

  // ── Visão de detalhe de um sub-relatório ──────────────────────────────────
  if (ativo && itemAtivo) {
    const Icone = itemAtivo.icone;
    return (
      <div className="rel-detalhe">
        <div className="rel-detalhe__topo">
          <button className="rel-btn-voltar" onClick={() => setAtivo(null)}>
            <ArrowLeft size={16} />
            Relatórios
          </button>
          <div className="rel-detalhe__titulo">
            <span
              className="rel-card__icone-wrap"
              style={{ background: `${itemAtivo.cor}18`, color: itemAtivo.cor }}
            >
              <Icone size={20} />
            </span>
            <div>
              <h2>{itemAtivo.label}</h2>
              <p>{itemAtivo.descricao}</p>
            </div>
          </div>
        </div>

        <ConteudoRelatorio id={ativo} cargo={cargo} vendedorId={vendedorId} />
      </div>
    );
  }

  // ── Grid de cards ──────────────────────────────────────────────────────────
  return (
    <div className="rel-wrapper">
      <div className="rel-cabecalho">
        <h1 className="rel-titulo">Relatórios</h1>
        <p className="rel-subtitulo">
          Selecione um relatório abaixo.{" "}
          {!isAdmin && (
            <span className="rel-subtitulo--hint">
              Relatórios com cadeado exigem permissão do administrador.
            </span>
          )}
        </p>
      </div>

      <div className="rel-grid">
        {SUB_RELATORIOS.map((item) => (
          <CardRelatorio
            key={item.id}
            item={item}
            temAcesso={temAcesso(item.id)}
            onClick={setAtivo}
          />
        ))}
      </div>

      {/* Legenda */}
      <div className="rel-legenda">
        <span className="rel-legenda__item">
          <span className="rel-legenda__dot rel-legenda__dot--ok" />
          Disponível
        </span>
        <span className="rel-legenda__item">
          <Lock size={12} />
          Bloqueado — fale com o administrador
        </span>
      </div>
    </div>
  );
}

/*
──────────────────────────────────────────────────────────────────────────────
  CSS NECESSÁRIO — adicione ao seu arquivo global
──────────────────────────────────────────────────────────────────────────────

.rel-wrapper {
  padding: 1.5rem;
  max-width: 900px;
}

.rel-cabecalho {
  margin-bottom: 1.5rem;
}

.rel-titulo {
  font-size: 1.375rem;
  font-weight: 700;
  color: var(--cor-texto, #111827);
  margin: 0 0 0.25rem;
}

.rel-subtitulo {
  font-size: 0.875rem;
  color: var(--cor-texto-secundario, #6b7280);
  margin: 0;
}

.rel-subtitulo--hint {
  color: #9ca3af;
}

.rel-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1rem;
}

.rel-card {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1.1rem;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #fff;
  cursor: pointer;
  text-align: left;
  transition: box-shadow 0.15s, border-color 0.15s, transform 0.1s;
  position: relative;
  width: 100%;
}

.rel-card:not(.rel-card--bloqueado):hover {
  box-shadow: 0 4px 16px rgba(0,0,0,0.08);
  border-color: #d1d5db;
  transform: translateY(-1px);
}

.rel-card--bloqueado {
  background: #f9fafb;
  cursor: not-allowed;
  opacity: 0.75;
}

.rel-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.rel-card__icone-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 8px;
  flex-shrink: 0;
}

.rel-card__badge-bloqueado {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 0.7rem;
  color: #9ca3af;
  background: #f3f4f6;
  border-radius: 4px;
  padding: 2px 6px;
}

.rel-card__body {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.rel-card__label {
  font-size: 0.925rem;
  font-weight: 600;
  color: var(--cor-texto, #111827);
}

.rel-card--bloqueado .rel-card__label {
  color: #9ca3af;
}

.rel-card__desc {
  font-size: 0.78rem;
  color: #9ca3af;
  line-height: 1.3;
}

.rel-card__seta {
  color: #d1d5db;
  margin-top: auto;
}

.rel-legenda {
  display: flex;
  align-items: center;
  gap: 1.25rem;
  margin-top: 1.5rem;
  font-size: 0.78rem;
  color: #9ca3af;
}

.rel-legenda__item {
  display: flex;
  align-items: center;
  gap: 5px;
}

.rel-legenda__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.rel-legenda__dot--ok {
  background: #10b981;
}

.rel-detalhe {
  padding: 1.5rem;
}

.rel-detalhe__topo {
  margin-bottom: 1.5rem;
}

.rel-btn-voltar {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.85rem;
  color: var(--cor-primaria, #2563eb);
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  margin-bottom: 1rem;
}

.rel-btn-voltar:hover {
  text-decoration: underline;
}

.rel-detalhe__titulo {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.rel-detalhe__titulo h2 {
  margin: 0 0 0.15rem;
  font-size: 1.2rem;
  font-weight: 700;
}

.rel-detalhe__titulo p {
  margin: 0;
  font-size: 0.85rem;
  color: #6b7280;
}

.rel-conteudo-placeholder {
  background: #f9fafb;
  border: 1px dashed #d1d5db;
  border-radius: 10px;
  padding: 2rem;
  color: #6b7280;
  font-size: 0.9rem;
}

.rel-aviso-vendedor {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: 6px;
  padding: 0.6rem 0.9rem;
  font-size: 0.82rem;
  color: #1d4ed8;
  margin-bottom: 1rem;
}
*/
