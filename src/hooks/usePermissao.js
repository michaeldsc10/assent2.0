// hooks/usePermissao.js
// Hook auxiliar que consome o AuthContext e devolve helpers prontos para uso
// na sidebar, nos botões de ação e nos guards de rota.

import { useContext } from "react";
import { AuthContext } from "../AuthContext";

/**
 * Retorna as funções de permissão + helper para filtrar itens de menu.
 *
 * Uso:
 *   const { podeVer, podeCriar, podeEditar, podeExcluir, filtrarNav } = usePermissao();
 */
export function usePermissao() {
  const {
    cargo,
    isAdmin,
    isVendedor,
    podeVer,
    podeCriar,
    podeEditar,
    podeExcluir,
    podeVerRelatorio,
    loadingAuth,
  } = useContext(AuthContext);

  /**
   * Filtra um array de itens de nav.
   * Cada item deve ter a propriedade `modulo` (string) usada em podeVer().
   * Itens sem a propriedade `modulo` são sempre exibidos (ex: separadores).
   *
   * @param {Array<{modulo?: string, [key: string]: any}>} itens
   * @returns {Array} itens filtrados
   */
  function filtrarNav(itens) {
    return itens.filter((item) => {
      if (!item.modulo) return true;           // separadores / títulos de seção
      return podeVer(item.modulo);
    });
  }

  /**
   * Retorna true se o cargo pode realizar a ação no módulo.
   * Usado para controlar visibilidade de botões (Novo, Editar, Excluir).
   */
  function podeAcao(acao, modulo) {
    switch (acao) {
      case "criar":   return podeCriar(modulo);
      case "editar":  return podeEditar(modulo);
      case "excluir": return podeExcluir(modulo);
      case "ver":     return podeVer(modulo);
      default:        return false;
    }
  }

  return {
    cargo,
    isAdmin,
    isVendedor,
    loadingAuth,
    podeVer,
    podeCriar,
    podeEditar,
    podeExcluir,
    podeVerRelatorio,
    filtrarNav,
    podeAcao,
  };
}

/*
──────────────────────────────────────────────────────────────────────────────
  EXEMPLOS DE USO
──────────────────────────────────────────────────────────────────────────────

// 1. Botões de ação dentro de um módulo (ex: Clientes.jsx)
import { usePermissao } from "../hooks/usePermissao";

function Clientes() {
  const { podeCriar, podeEditar, podeExcluir } = usePermissao();

  return (
    <>
      {podeCriar("clientes") && (
        <button onClick={handleNovo}>+ Novo Cliente</button>
      )}

      {linhas.map((c) => (
        <tr key={c.id}>
          <td>{c.nome}</td>
          <td>
            {podeEditar("clientes") && (
              <button onClick={() => handleEditar(c)}>Editar</button>
            )}
            {podeExcluir("clientes") && (
              <button onClick={() => handleExcluir(c.id)}>Excluir</button>
            )}
          </td>
        </tr>
      ))}
    </>
  );
}

// 2. Sidebar — filtrar itens de menu
import { usePermissao } from "../hooks/usePermissao";

const NAV = [
  { label: "Dashboard",        modulo: "dashboard",        icone: LayoutDashboard },
  { label: "Agenda",           modulo: "agenda",           icone: Calendar },
  { label: "Clientes",         modulo: "clientes",         icone: Users },
  { label: "Produtos",         modulo: "produtos",         icone: Package },
  { label: "Serviços",         modulo: "servicos",         icone: Wrench },
  { label: "Fornecedores",     modulo: "fornecedores",     icone: Truck },
  { label: "Vendedores",       modulo: "vendedores",       icone: UserTie },
  { label: "Entrada Estoque",  modulo: "entradaEstoque",   icone: ArrowDownToLine },
  { label: "Compras",          modulo: "compras",          icone: ShoppingCart },
  { label: "Orçamentos",       modulo: "orcamentos",       icone: FileText },
  { label: "Vendas",           modulo: "vendas",           icone: TrendingUp },
  { label: "A Receber",        modulo: "aReceber",         icone: Coins },
  { label: "Caixa Diário",     modulo: "caixaDiario",      icone: Wallet },
  { label: "Despesas",         modulo: "despesas",         icone: Receipt },
  { label: "Relatórios",       modulo: "relatorios",       icone: BarChart2 },
  // Seção SISTEMA — sem modulo = sempre visível o título
  { label: "SISTEMA",          separador: true },
  { label: "Usuários",         modulo: "usuarios",         icone: UserPlus },
];

function Sidebar({ moduloAtivo, onNavegar }) {
  const { filtrarNav } = usePermissao();
  const navFiltrado = filtrarNav(NAV);

  return (
    <nav>
      {navFiltrado.map((item) => {
        if (item.separador) return <SeparadorNav key={item.label} label={item.label} />;
        const Icone = item.icone;
        return (
          <button
            key={item.modulo}
            className={moduloAtivo === item.label ? "ativo" : ""}
            onClick={() => onNavegar(item.label)}
          >
            <Icone size={18} />
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}
*/
