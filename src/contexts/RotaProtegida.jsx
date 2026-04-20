// RotaProtegida.jsx
// Wrapper que verifica se o cargo do usuário logado tem permissão para ver o módulo.
// Usa podeVer(modulo) do AuthContext.
// Se não tiver permissão → exibe <AcessoNegado />.
// Se ainda estiver carregando auth → exibe spinner.

import { useContext } from "react";
import { AuthContext } from "./AuthContext";

// ─── Tela de Acesso Negado ────────────────────────────────────────────────────
function AcessoNegado({ modulo }) {
  return (
    <div className="acesso-negado">
      <div className="acesso-negado__icone">🔒</div>
      <h2 className="acesso-negado__titulo">Acesso restrito</h2>
      <p className="acesso-negado__texto">
        Seu perfil não tem permissão para acessar
        {modulo ? <strong> {modulo}</strong> : " este módulo"}.
      </p>
      <p className="acesso-negado__sub">
        Fale com o administrador da sua empresa caso precise de acesso.
      </p>
    </div>
  );
}

// ─── Spinner de carregamento ──────────────────────────────────────────────────
function Carregando() {
  return (
    <div className="acesso-negado">
      <div className="acesso-negado__spinner" />
    </div>
  );
}

// ─── RotaProtegida ────────────────────────────────────────────────────────────
/**
 * @param {string}  modulo    - Chave do módulo, igual ao usado em podeVer().
 *                              Ex: "vendas", "relatorios", "dashboard"
 * @param {ReactNode} children - Conteúdo a renderizar se tiver permissão.
 * @param {string}  [label]   - Nome amigável do módulo (exibido na tela de erro).
 *                              Se omitido, usa `modulo`.
 */
export default function RotaProtegida({ modulo, children, label }) {
  const { podeVer, loadingAuth } = useContext(AuthContext);

  if (loadingAuth) return <Carregando />;

  if (!podeVer(modulo)) {
    return <AcessoNegado modulo={label ?? modulo} />;
  }

  return children;
}

/*
──────────────────────────────────────────────────────────────────────────────
  CSS NECESSÁRIO — adicione ao seu arquivo global (ex: index.css ou App.css)
──────────────────────────────────────────────────────────────────────────────

.acesso-negado {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  min-height: 60vh;
  text-align: center;
  padding: 2rem;
  color: var(--cor-texto-secundario, #6b7280);
}

.acesso-negado__icone {
  font-size: 3rem;
  line-height: 1;
}

.acesso-negado__titulo {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--cor-texto, #111827);
  margin: 0;
}

.acesso-negado__texto {
  margin: 0;
  font-size: 0.95rem;
}

.acesso-negado__sub {
  margin: 0;
  font-size: 0.85rem;
  opacity: 0.7;
}

.acesso-negado__spinner {
  width: 2rem;
  height: 2rem;
  border: 3px solid #e5e7eb;
  border-top-color: var(--cor-primaria, #2563eb);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

──────────────────────────────────────────────────────────────────────────────
  USO NO renderModulo() DO Dashboard.jsx
──────────────────────────────────────────────────────────────────────────────

import RotaProtegida from "./RotaProtegida";

// Dentro de renderModulo(modulo):
case "Vendas":
  return (
    <RotaProtegida modulo="vendas" label="Vendas">
      <Vendas isPro={isPro} />
    </RotaProtegida>
  );

case "Dashboard":
  return (
    <RotaProtegida modulo="dashboard" label="Dashboard">
      <DashboardHome />
    </RotaProtegida>
  );

case "Relatórios":
  return (
    <RotaProtegida modulo="relatorios" label="Relatórios">
      <Relatorios />
    </RotaProtegida>
  );

// ... repita para todos os módulos usando a mesma chave que podeVer() espera.
*/
