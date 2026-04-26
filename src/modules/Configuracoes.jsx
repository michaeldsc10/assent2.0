/* ═══════════════════════════════════════════════════
   ASSENT v2.0 — Configuracoes.jsx
   Estrutura: users/{uid}/config/geral (doc único, merge)
   ═══════════════════════════════════════════════════ */

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Building2, Lock, CreditCard, LayoutDashboard, Package,
  Eye, EyeOff, Check, AlertCircle, Save,
  ChevronRight, Camera, Shield, Keyboard, Activity,
  Filter, RefreshCw, Search, ChevronDown,
  Zap, Copy, ExternalLink, BookOpen, X, CheckCircle2,
} from "lucide-react";

import { db } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import { doc, getDoc, setDoc, collection, query, orderBy, limit, getDocs, startAfter } from "firebase/firestore";
import {
  reauthenticateWithCredential,
  EmailAuthProvider,
  updatePassword,
} from "firebase/auth";

/* ── Validadores CPF / CNPJ ── */
const validarCPF = (cpf) => {
  cpf = cpf.replace(/\D/g, "");
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
  let soma = 0;
  for (let i = 0; i < 9; i++) soma += parseInt(cpf[i]) * (10 - i);
  let resto = soma % 11;
  const d1 = resto < 2 ? 0 : 11 - resto;
  if (d1 !== parseInt(cpf[9])) return false;
  soma = 0;
  for (let i = 0; i < 10; i++) soma += parseInt(cpf[i]) * (11 - i);
  resto = soma % 11;
  const d2 = resto < 2 ? 0 : 11 - resto;
  return d2 === parseInt(cpf[10]);
};

const validarCNPJ = (cnpj) => {
  cnpj = cnpj.replace(/\D/g, "");
  if (cnpj.length !== 14 || /^(\d)\1+$/.test(cnpj)) return false;
  let t = cnpj.length - 2;
  let n = cnpj.substring(0, t);
  let d = cnpj.substring(t);
  let s = 0, p = t - 7;
  for (let i = t; i >= 1; i--) { s += parseInt(n.charAt(t - i)) * p--; if (p < 2) p = 9; }
  let r = s % 11 < 2 ? 0 : 11 - (s % 11);
  if (r !== parseInt(d.charAt(0))) return false;
  t++; n = cnpj.substring(0, t); s = 0; p = t - 7;
  for (let i = t; i >= 1; i--) { s += parseInt(n.charAt(t - i)) * p--; if (p < 2) p = 9; }
  r = s % 11 < 2 ? 0 : 11 - (s % 11);
  return r === parseInt(d.charAt(1));
};

/* ══════════════════════════════════════════════════════
   CONSTANTES
   ══════════════════════════════════════════════════════ */
const MENU_SECTIONS = [
  { key: "dashboard",       label: "Dashboard",         sub: "Visão geral e KPIs",       icon: "📊", locked: true  },
  { key: "clientes",        label: "Clientes",           sub: "Cadastro e histórico",     icon: "👥", locked: false },
  { key: "produtos",        label: "Produtos",           sub: "Catálogo de produtos",     icon: "📦", locked: false },
  { key: "servicos",        label: "Serviços",           sub: "Catálogo de serviços",     icon: "🔧", locked: false },
  { key: "entrada_estoque", label: "Estoque",             sub: "Movimentação de entrada",  icon: "📥", locked: false },
  { key: "vendas",          label: "Vendas",             sub: "PDV e registro de vendas",       icon: "🛒", locked: false },
  { key: "pdv",            label: "PDV",                sub: "Ponto de Venda (leitor de código)", icon: "🏪", locked: false },
  { key: "mesas",           label: "Mesas",              sub: "Gestão de mesas e comandas",     icon: "🪑", locked: false },
  { key: "matriculas",      label: "Matrículas",         sub: "Alunos e mensalidades",          icon: "🎓", locked: false },
  { key: "fiado",           label: "A Receber",           sub: "Contas a receber",         icon: "💳", locked: false },
  { key: "caixa",           label: "Caixa Diário",       sub: "Abertura e fechamento",    icon: "💰", locked: false },
  { key: "despesas",        label: "Despesas",           sub: "Controle de saídas",       icon: "📉", locked: false },
  { key: "fornecedores",    label: "Fornecedores",       sub: "Cadastro de fornecedores", icon: "🏭", locked: false },
  { key: "relatorios",      label: "Relatórios",         sub: "Análises e exportações",   icon: "📈", locked: false },
  { key: "agenda",          label: "Agenda",             sub: "Compromissos e tarefas",   icon: "📅", locked: false },
  { key: "orcamentos",         label: "Orçamentos",      sub: "Orçamentos",            icon: "⚡", locked: false },
  { key: "vendedores",      label: "Vendedores",         sub: "Equipe de vendas",         icon: "👔", locked: false },
   
  { key: "config",          label: "Configurações",      sub: "Esta tela",                icon: "⚙️", locked: true  },
];

const TAXAS_DEFAULT = {
  debito:     "1.99",
  pix:        "0.00",
  credito_1:  "2.99",
  credito_2:  "3.19",
  credito_3:  "3.39",
  credito_4:  "3.59",
  credito_5:  "3.79",
  credito_6:  "3.99",
  credito_7:  "4.19",
  credito_8:  "4.39",
  credito_9:  "4.59",
  credito_10: "4.79",
  credito_11: "4.99",
  credito_12: "5.19",
};

const NAV = [
  { id: "empresa",    label: "Empresa",             icon: Building2      },
  { id: "seguranca",  label: "Segurança",            icon: Shield         },
  { id: "financeiro", label: "Financeiro",           icon: CreditCard     },
  { id: "pagamentos", label: "Pagamentos Online",    icon: Zap            },
  { id: "menu",       label: "Menu do Sistema",      icon: LayoutDashboard},
  { id: "estoque",    label: "Estoque",              icon: Package        },
  { id: "atalhos",    label: "Atalhos",              icon: Keyboard       },
  { id: "log",        label: "Log de Atividades",    icon: Activity       },
];

/* ══════════════════════════════════════════════════════
   MAPEAMENTO DE ATALHOS DE TECLADO
   Combinação: Alt + tecla → navega para o módulo
   ══════════════════════════════════════════════════════ */
export const ATALHOS_MAP = [
  { code: "KeyD", display: "Alt + D", key: "dashboard",       hint: "Dashboard"           },
  { code: "KeyC", display: "Alt + C", key: "clientes",        hint: "Clientes"             },
  { code: "KeyP", display: "Alt + P", key: "produtos",        hint: "Produtos"             },
  { code: "KeyS", display: "Alt + S", key: "servicos",        hint: "Serviços"             },
  { code: "KeyE", display: "Alt + E", key: "entrada_estoque", hint: "Entrada"              },
  { code: "KeyV", display: "Alt + V", key: "vendas",          hint: "Vendas"               },
   { code: "KeyH", display: "Alt + U", key: "matriculas",      hint: "matrícUlas (alunos)" },
  { code: "KeyF", display: "Alt + F", key: "fiado",           hint: "Fiado (F de Fiado)"   },
  { code: "KeyX", display: "Alt + X", key: "caixa",           hint: "Caixa (Cx)"           },
  { code: "KeyZ", display: "Alt + Z", key: "despesas",        hint: "Despesas"             },
  { code: "KeyN", display: "Alt + N", key: "fornecedores",    hint: "forNecedores"         },
  { code: "KeyR", display: "Alt + R", key: "relatorios",      hint: "Relatórios"           },
  { code: "KeyA", display: "Alt + A", key: "agenda",          hint: "Agenda"               },
  { code: "KeyO", display: "Alt + O", key: "orcamentos",      hint: "Orçamentos"           },
  { code: "KeyM", display: "Alt + M", key: "vendedores",      hint: "equipe (Membros)"     },
  { code: "KeyT", display: "Alt + T", key: "mesas",           hint: "Mesas (T de Table)"   },
  { code: "KeyB", display: "Alt + B", key: "pdv",             hint: "PDV (B de Barcode)"   },
  { code: "KeyG", display: "Alt + G", key: "config",          hint: "confiGurações"        },
];

/* Lookup rápido: code → key do módulo */
const ATALHO_LOOKUP = Object.fromEntries(ATALHOS_MAP.map(a => [a.code, a.key]));

/* ══════════════════════════════════════════════════════
   HOOK: useAtalhosTeclado
   Deve ser chamado no App.jsx (raiz), onde setModule e
   menuVisivel já existem. Zero dependência de Configuracoes.
   ══════════════════════════════════════════════════════ */
export function useAtalhosTeclado(setModule, menuVisivel = {}) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      /* 1. Apenas combinações Alt + tecla */
      if (!e.altKey) return;

      /* 2. Ignorar se foco está em campo de texto */
      const tag = document.activeElement?.tagName;
      if (
        tag === "INPUT"    ||
        tag === "TEXTAREA" ||
        document.activeElement?.isContentEditable
      ) return;

      /* 3. Verificar se o código tem atalho mapeado */
      const moduleKey = ATALHO_LOOKUP[e.code];
      if (!moduleKey) return;

      /* 4. Verificar visibilidade do módulo */
      const section = MENU_SECTIONS.find(s => s.key === moduleKey);
      if (!section) return;
      /* Módulos locked são sempre visíveis; os outros precisam estar ativos */
      if (!section.locked && menuVisivel[moduleKey] === false) return;

      /* 5. Navegar — previne ação padrão do navegador (ex: Alt+F abre menu) */
      e.preventDefault();
      setModule(moduleKey);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [setModule, menuVisivel]);
}

/* ══════════════════════════════════════════════════════
   CSS
   ══════════════════════════════════════════════════════ */
const CSS = `
  @keyframes fadeIn  { from { opacity: 0 } to { opacity: 1 } }
  @keyframes slideUp {
    from { opacity: 0; transform: translateY(14px) }
    to   { opacity: 1; transform: translateY(0) }
  }
  @keyframes spin { to { transform: rotate(360deg) } }

  .cfg-root {
    display: flex; flex-direction: column;
    height: 100vh; width: 100%; overflow: hidden;
  }
  .cfg-topbar {
    padding: 14px 22px;
    background: var(--s1); border-bottom: 1px solid var(--border);
    display: flex; align-items: center; gap: 14px; flex-shrink: 0;
  }
  .cfg-topbar-title h1 {
    font-family: 'Sora', sans-serif; font-size: 17px; font-weight: 600; color: var(--text);
  }
  .cfg-topbar-title p { font-size: 11px; color: var(--text-2); margin-top: 2px; }

  .cfg-body {
    display: flex; flex: 1;
    overflow: hidden; min-height: 0;
  }
  .cfg-nav {
    width: 220px; flex-shrink: 0;
    background: var(--s1); border-right: 1px solid var(--border);
    padding: 16px 10px; display: flex; flex-direction: column; gap: 2px;
    overflow-y: auto;
  }
  .cfg-panel {
    flex: 1; overflow-y: auto; padding: 24px;
    display: flex; flex-direction: column; gap: 20px;
    animation: fadeIn .18s ease; 
    height: 100%;
  }
  .cfg-panel::-webkit-scrollbar { width: 3px; }
  .cfg-panel::-webkit-scrollbar-thumb { background: var(--text-3); border-radius: 2px; }

  .cfg-nav-item {
    display: flex; align-items: center; gap: 10px;
    padding: 9px 12px; border-radius: 9px; cursor: pointer;
    font-family: 'DM Sans', sans-serif; font-size: 13px;
    color: var(--text-2); border: 1px solid transparent;
    transition: all .13s; background: transparent;
    text-align: left; width: 100%;
  }
  .cfg-nav-item:hover { background: var(--s2); color: var(--text); }
  .cfg-nav-item.active { background: var(--s2); color: var(--text); border-color: var(--border-h); }
  .cfg-nav-item.active .cfg-nav-icon { color: var(--gold); }
  .cfg-nav-label { flex: 1; }
  .cfg-nav-icon  { flex-shrink: 0; }
  .cfg-nav-group-label {
    font-size: 10px; font-weight: 600; letter-spacing: .07em;
    text-transform: uppercase; color: var(--text-3);
    padding: 0 12px; margin-bottom: 4px; margin-top: 8px;
  }

  .cfg-card {
    background: var(--s1); border: 1px solid var(--border);
    border-radius: 14px; overflow: hidden; animation: slideUp .18s ease;
    flex-shrink: 0;
  }
  .cfg-card-header {
    padding: 16px 20px; border-bottom: 1px solid var(--border);
    display: flex; align-items: center; gap: 10px;
  }
  .cfg-card-header-icon {
    width: 32px; height: 32px; border-radius: 8px;
    background: var(--s3); border: 1px solid var(--border-h);
    display: flex; align-items: center; justify-content: center; color: var(--gold);
  }
  .cfg-card-title {
    font-family: 'Sora', sans-serif; font-size: 14px; font-weight: 600; color: var(--text);
  }
  .cfg-card-sub { font-size: 11px; color: var(--text-2); margin-top: 1px; }
  .cfg-card-body { padding: 20px; }
  .cfg-card-footer {
    padding: 13px 20px; border-top: 1px solid var(--border);
    display: flex; justify-content: flex-end; gap: 10px; background: var(--s2);
  }

  .form-group  { margin-bottom: 16px; }
  .form-group:last-child { margin-bottom: 0; }
  .form-label {
    display: block; font-size: 10px; font-weight: 600;
    letter-spacing: .07em; text-transform: uppercase;
    color: var(--text-2); margin-bottom: 7px;
  }
  .form-label-req { color: var(--gold); margin-left: 2px; }
  .form-input {
    width: 100%; background: var(--s2);
    border: 1px solid var(--border); border-radius: 9px;
    padding: 10px 13px; color: var(--text); font-size: 13px;
    font-family: 'DM Sans', sans-serif;
    outline: none; transition: border-color .15s, box-shadow .15s;
    box-sizing: border-box;
  }
  .form-input:focus { border-color: var(--gold); box-shadow: 0 0 0 3px rgba(200,165,94,0.1); }
  .form-input.err   { border-color: var(--red); }
  .form-input.err:focus { box-shadow: 0 0 0 3px rgba(224,82,82,0.1); }
  .form-error { font-size: 11px; color: var(--red); margin-top: 5px; }
  .form-row   { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }

  .input-pass-wrap { position: relative; }
  .input-pass-wrap .form-input { padding-right: 40px; }
  .input-pass-toggle {
    position: absolute; right: 11px; top: 50%; transform: translateY(-50%);
    background: none; border: none; cursor: pointer;
    color: var(--text-3); padding: 0; line-height: 1;
    display: flex; align-items: center; transition: color .13s;
  }
  .input-pass-toggle:hover { color: var(--text-2); }

  .btn-primary {
    padding: 9px 20px; border-radius: 9px;
    background: var(--gold); color: #0a0808; border: none; cursor: pointer;
    font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 600;
    display: flex; align-items: center; gap: 6px;
    transition: opacity .13s, transform .1s;
  }
  .btn-primary:hover  { opacity: .88; }
  .btn-primary:active { transform: scale(.97); }
  .btn-primary:disabled { opacity: .5; cursor: not-allowed; }

  .btn-secondary {
    padding: 9px 20px; border-radius: 9px;
    background: var(--s3); color: var(--text-2);
    border: 1px solid var(--border); cursor: pointer;
    font-family: 'DM Sans', sans-serif; font-size: 13px;
    transition: background .13s, color .13s;
  }
  .btn-secondary:hover { background: var(--s2); color: var(--text); }

  .cfg-toast {
    position: fixed; bottom: 24px; right: 24px;
    padding: 11px 16px; border-radius: 10px;
    display: flex; align-items: center; gap: 8px;
    font-family: 'DM Sans', sans-serif; font-size: 13px;
    z-index: 9999; animation: slideUp .18s ease;
    box-shadow: 0 8px 32px rgba(0,0,0,0.5);
  }
  .cfg-toast.success {
    background: rgba(72,187,120,0.12); border: 1px solid rgba(72,187,120,0.3); color: #48bb78;
  }
  .cfg-toast.error {
    background: rgba(224,82,82,0.12); border: 1px solid rgba(224,82,82,0.3); color: var(--red);
  }

  .logo-upload-area {
    border: 1.5px dashed var(--border-h); border-radius: 12px; padding: 24px 16px;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 10px; cursor: pointer; transition: border-color .15s, background .15s;
    background: var(--s2);
  }
  .logo-upload-area:hover { border-color: var(--gold); background: rgba(200,165,94,0.04); }
  .logo-upload-area.has-logo { padding: 12px; }
  .logo-preview { max-height: 80px; max-width: 200px; object-fit: contain; border-radius: 6px; }
  .logo-upload-hint { font-size: 11px; color: var(--text-3); text-align: center; line-height: 1.5; }
  .logo-upload-btn-row { display: flex; gap: 8px; margin-top: 6px; }
  .btn-logo-remove {
    padding: 5px 12px; border-radius: 7px; background: var(--red-d); color: var(--red);
    border: 1px solid rgba(224,82,82,.25); cursor: pointer;
    font-size: 11px; font-family: 'DM Sans', sans-serif; transition: background .13s;
  }
  .btn-logo-remove:hover { background: rgba(224,82,82,.18); }

  .taxa-table { width: 100%; border-collapse: collapse; }
  .taxa-table thead tr { background: var(--s2); }
  .taxa-table th {
    font-size: 10px; font-weight: 600; letter-spacing: .06em;
    text-transform: uppercase; color: var(--text-3);
    padding: 10px 14px; text-align: left; border-bottom: 1px solid var(--border);
  }
  .taxa-table td {
    padding: 8px 14px; border-bottom: 1px solid var(--border);
    font-size: 13px; color: var(--text-2); vertical-align: middle;
  }
  .taxa-table tr:last-child td { border-bottom: none; }
  .taxa-table tr:hover td { background: rgba(255,255,255,0.01); }
  .taxa-bandeira {
    font-family: 'Sora', sans-serif; font-size: 12px; font-weight: 600; color: var(--text);
  }
  .taxa-tipo-badge {
    display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 20px;
    font-size: 10px; font-weight: 600; background: var(--s3); color: var(--text-3);
    border: 1px solid var(--border);
  }
  .taxa-input {
    width: 80px; background: var(--s2); border: 1px solid var(--border); border-radius: 7px;
    padding: 5px 10px; color: var(--text); font-size: 13px;
    font-family: 'DM Sans', sans-serif; outline: none;
    transition: border-color .15s, box-shadow .15s; text-align: right;
  }
  .taxa-input:focus { border-color: var(--gold); box-shadow: 0 0 0 3px rgba(200,165,94,0.1); }
  .taxa-pct { font-size: 12px; color: var(--text-3); margin-left: 5px; }
  .taxa-section-divider td {
    padding: 5px 14px; font-size: 9px; font-weight: 700; letter-spacing: .08em;
    text-transform: uppercase; color: var(--text-3);
    background: var(--s3); border-bottom: 1px solid var(--border);
  }

  .menu-toggle-list { display: flex; flex-direction: column; gap: 6px; }
  .menu-toggle-item {
    display: flex; align-items: center; gap: 12px;
    padding: 11px 14px; border-radius: 9px;
    border: 1px solid var(--border); background: var(--s2); transition: border-color .13s;
  }
  .menu-toggle-item:hover { border-color: var(--border-h); }
  .menu-toggle-icon {
    width: 28px; height: 28px; border-radius: 7px;
    background: var(--s3); border: 1px solid var(--border-h);
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0; font-size: 14px;
  }
  .menu-toggle-label { font-size: 13px; color: var(--text); font-family: 'DM Sans', sans-serif; }
  .menu-toggle-sub   { font-size: 11px; color: var(--text-3); margin-top: 1px; }
  .menu-toggle-locked {
    font-size: 10px; color: var(--text-3); background: var(--s3);
    border: 1px solid var(--border); border-radius: 20px; padding: 2px 8px; white-space: nowrap;
  }

  .toggle-switch { position: relative; width: 38px; height: 22px; flex-shrink: 0; }
  .toggle-switch input { opacity: 0; width: 0; height: 0; position: absolute; }
  .toggle-track {
    position: absolute; inset: 0; border-radius: 22px;
    background: var(--s3); border: 1px solid var(--border);
    cursor: pointer; transition: background .2s, border-color .2s;
  }
  .toggle-switch input:checked + .toggle-track {
    background: rgba(200,165,94,0.25); border-color: var(--gold);
  }
  .toggle-track::after {
    content: ''; position: absolute; width: 16px; height: 16px; border-radius: 50%;
    background: var(--text-3); top: 2px; left: 2px; transition: transform .2s, background .2s;
  }
  .toggle-switch input:checked + .toggle-track::after {
    transform: translateX(16px); background: var(--gold);
  }

  .estoque-hint {
    font-size: 12px; color: var(--text-3); background: var(--s3); border: 1px solid var(--border);
    border-radius: 8px; padding: 10px 14px; margin-top: 12px; line-height: 1.6;
  }
  .cfg-spinner {
    width: 14px; height: 14px; border-radius: 50%;
    border: 2px solid rgba(0,0,0,0.15); border-top-color: #0a0808;
    animation: spin .6s linear infinite; flex-shrink: 0;
  }
  .cfg-alert {
    display: flex; align-items: flex-start; gap: 10px;
    padding: 12px 14px; border-radius: 9px; font-size: 12px; line-height: 1.6;
  }
  .cfg-loading {
    padding: 56px 20px; text-align: center; color: var(--text-3); font-size: 13px;
  }

  /* ── Seção Atalhos ── */
  .atalhos-intro {
    font-size: 12px; color: var(--text-3); line-height: 1.7;
    background: var(--s2); border: 1px solid var(--border);
    border-radius: 9px; padding: 12px 14px; margin-bottom: 4px;
  }
  .atalhos-intro strong { color: var(--gold); font-weight: 600; }
  .atalhos-list { display: flex; flex-direction: column; gap: 6px; }
  .atalho-item {
    display: flex; align-items: center; gap: 12px;
    padding: 10px 14px; border-radius: 9px;
    border: 1px solid var(--border); background: var(--s2);
    transition: border-color .13s, opacity .13s;
  }
  .atalho-item:not(.atalho-disabled):hover { border-color: var(--border-h); }
  .atalho-disabled { opacity: .38; }
  .atalho-icon {
    width: 28px; height: 28px; border-radius: 7px;
    background: var(--s3); border: 1px solid var(--border-h);
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0; font-size: 14px;
  }
  .atalho-info { flex: 1; min-width: 0; }
  .atalho-label { font-size: 13px; color: var(--text); font-family: 'DM Sans', sans-serif; }
  .atalho-sub   { font-size: 11px; color: var(--text-3); margin-top: 1px; }
  .atalho-key {
    font-family: 'DM Mono', 'Courier New', monospace;
    font-size: 11px; font-weight: 700; white-space: nowrap;
    background: var(--s3); border: 1px solid var(--border-h);
    border-bottom-width: 2px; border-radius: 6px;
    padding: 3px 10px; color: var(--gold); letter-spacing: .04em;
    flex-shrink: 0;
  }
  .atalho-hidden-badge {
    font-size: 10px; color: var(--text-3); background: var(--s3);
    border: 1px solid var(--border); border-radius: 20px;
    padding: 2px 8px; white-space: nowrap; flex-shrink: 0;
  }

  /* ── Seção Log de Atividades ── */
  .log-toolbar {
    display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
    margin-bottom: 4px;
  }
  .log-search-wrap {
    flex: 1; min-width: 160px; position: relative;
    display: flex; align-items: center;
  }
  .log-search-wrap svg { position: absolute; left: 11px; pointer-events: none; }
  .log-search-input {
    width: 100%; background: var(--s2); border: 1px solid var(--border);
    border-radius: 9px; padding: 8px 12px 8px 34px;
    color: var(--text); font-size: 13px;
    font-family: 'DM Sans', sans-serif; outline: none;
    transition: border-color .15s;
  }
  .log-search-input:focus { border-color: var(--gold); }

  .log-select {
    background: var(--s2); border: 1px solid var(--border);
    border-radius: 9px; padding: 8px 32px 8px 12px;
    color: var(--text); font-size: 12px;
    font-family: 'DM Sans', sans-serif; outline: none;
    appearance: none; cursor: pointer;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
    background-repeat: no-repeat; background-position: right 10px center;
    min-width: 130px;
  }
  .log-select:focus { border-color: var(--gold); }

  .log-btn-refresh {
    padding: 8px 14px; border-radius: 9px; background: var(--s2);
    border: 1px solid var(--border); color: var(--text-2);
    cursor: pointer; display: flex; align-items: center; gap: 6px;
    font-size: 12px; font-family: 'DM Sans', sans-serif;
    transition: background .13s, color .13s; flex-shrink: 0;
  }
  .log-btn-refresh:hover { background: var(--s3); color: var(--text); }
  .log-btn-refresh:disabled { opacity: .5; cursor: not-allowed; }

  .log-list { display: flex; flex-direction: column; gap: 6px; }
  .log-item {
    display: flex; align-items: flex-start; gap: 12px;
    padding: 12px 14px; border-radius: 10px;
    border: 1px solid var(--border); background: var(--s2);
    transition: border-color .13s;
  }
  .log-item:hover { border-color: var(--border-h); }

  .log-acao-badge {
    flex-shrink: 0; padding: 3px 9px; border-radius: 20px;
    font-size: 10px; font-weight: 700; letter-spacing: .04em;
    text-transform: uppercase; white-space: nowrap; margin-top: 1px;
  }
  .log-acao-criar   { background: rgba(72,187,120,0.12); color: #48bb78; border: 1px solid rgba(72,187,120,0.25); }
  .log-acao-editar  { background: rgba(200,165,94,0.12); color: var(--gold); border: 1px solid rgba(200,165,94,0.25); }
  .log-acao-excluir { background: rgba(224,82,82,0.12);  color: var(--red);  border: 1px solid rgba(224,82,82,0.25); }

  .log-info { flex: 1; min-width: 0; }
  .log-desc {
    font-size: 13px; color: var(--text); font-family: 'DM Sans', sans-serif;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .log-meta {
    display: flex; align-items: center; gap: 8px; margin-top: 4px; flex-wrap: wrap;
  }
  .log-meta-item { font-size: 11px; color: var(--text-3); }
  .log-meta-dot { font-size: 11px; color: var(--text-3); }
  .log-modulo-badge {
    font-size: 10px; font-weight: 600; padding: 1px 7px; border-radius: 20px;
    background: var(--s3); border: 1px solid var(--border); color: var(--text-2);
  }

  .log-empty {
    padding: 56px 20px; text-align: center; color: var(--text-3); font-size: 13px;
  }
  .log-loading {
    padding: 48px 20px; text-align: center; color: var(--text-3); font-size: 13px;
    display: flex; align-items: center; justify-content: center; gap: 8px;
  }
  .log-load-more {
    padding: 9px 20px; border-radius: 9px; background: var(--s2);
    border: 1px solid var(--border); color: var(--text-2);
    cursor: pointer; font-size: 12px; font-family: 'DM Sans', sans-serif;
    transition: all .13s; display: flex; align-items: center; justify-content: center; gap: 6px;
    width: 100%; margin-top: 4px;
  }
  .log-load-more:hover { background: var(--s3); color: var(--text); }
  .log-load-more:disabled { opacity: .5; cursor: not-allowed; }
  .log-count-bar {
    font-size: 11px; color: var(--text-3); text-align: right; padding-top: 4px;
  }

  /* ── Seção Pagamentos Online ── */
  .pag-provedor-card {
    border: 1.5px solid var(--border); border-radius: 12px;
    overflow: hidden; transition: border-color .15s;
  }
  .pag-provedor-card.ativo { border-color: rgba(200,165,94,0.5); }
  .pag-provedor-header {
    display: flex; align-items: center; gap: 14px;
    padding: 16px 18px; background: var(--s2);
    border-bottom: 1px solid var(--border);
  }
  .pag-provedor-logo {
    width: 42px; height: 42px; border-radius: 10px;
    display: flex; align-items: center; justify-content: center;
    font-size: 22px; background: #009ee3; color: #fff; flex-shrink: 0;
  }
  .pag-provedor-info { flex: 1; }
  .pag-provedor-nome { font-size: 14px; font-weight: 700; color: var(--text); font-family: 'Sora', sans-serif; }
  .pag-provedor-sub  { font-size: 11px; color: var(--text-3); margin-top: 2px; }
  .pag-provedor-badge {
    font-size: 10px; font-weight: 600; padding: 3px 10px; border-radius: 20px;
    background: rgba(72,187,120,0.12); color: #48bb78; border: 1px solid rgba(72,187,120,0.25);
  }
  .pag-provedor-badge.inativo {
    background: var(--s3); color: var(--text-3); border-color: var(--border);
  }
  .pag-provedor-body { padding: 18px; display: flex; flex-direction: column; gap: 14px; }
  .pag-token-wrap { position: relative; }
  .pag-token-wrap .form-input { padding-right: 42px; font-family: 'DM Mono', 'Courier New', monospace; font-size: 12px; }
  .pag-token-toggle {
    position: absolute; right: 11px; top: 50%; transform: translateY(-50%);
    background: none; border: none; cursor: pointer;
    color: var(--text-3); display: flex; align-items: center; transition: color .13s;
  }
  .pag-token-toggle:hover { color: var(--text-2); }
  .pag-status-row {
    display: flex; align-items: center; gap: 10px;
    background: var(--s3); border: 1px solid var(--border);
    border-radius: 9px; padding: 12px 14px;
  }
  .pag-status-dot {
    width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
    background: var(--text-3);
  }
  .pag-status-dot.ok { background: #48bb78; box-shadow: 0 0 6px rgba(72,187,120,0.5); }
  .pag-status-dot.erro { background: var(--red); }
  .pag-status-text { flex: 1; font-size: 12px; color: var(--text-2); }
  .pag-btn-tutorial {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 9px 16px; border-radius: 9px;
    background: rgba(200,165,94,0.08); border: 1px solid rgba(200,165,94,0.3);
    color: var(--gold); font-size: 12px; font-weight: 600;
    cursor: pointer; transition: all .15s;
    font-family: 'DM Sans', sans-serif;
  }
  .pag-btn-tutorial:hover { background: rgba(200,165,94,0.15); }
  .pag-info-box {
    background: rgba(200,165,94,0.06); border: 1px solid rgba(200,165,94,0.2);
    border-radius: 9px; padding: 12px 14px;
    font-size: 12px; color: var(--text-2); line-height: 1.7;
  }
  .pag-info-box strong { color: var(--gold); font-weight: 600; }

  /* ── Modal Tutorial ── */
  .tut-overlay {
    position: fixed; inset: 0; z-index: 10000;
    background: rgba(0,0,0,0.72); backdrop-filter: blur(6px);
    display: flex; align-items: center; justify-content: center;
    animation: fadeIn .15s ease; padding: 16px;
  }
  .tut-modal {
    background: #13151d; border: 1px solid rgba(255,255,255,0.1);
    border-radius: 18px; width: 100%; max-width: 560px;
    max-height: 90vh; display: flex; flex-direction: column;
    box-shadow: 0 32px 96px rgba(0,0,0,0.8), 0 0 0 1px rgba(200,165,94,0.15);
    animation: slideUp .2s ease;
  }
  .tut-header {
    display: flex; align-items: center; gap: 12px;
    padding: 18px 22px; border-bottom: 1px solid rgba(255,255,255,0.08);
  }
  .tut-header-icon {
    width: 38px; height: 38px; border-radius: 10px;
    background: rgba(200,165,94,0.15); border: 1px solid rgba(200,165,94,0.3);
    display: flex; align-items: center; justify-content: center; color: var(--gold); flex-shrink: 0;
  }
  .tut-header-title { flex: 1; }
  .tut-header-title h3 { font-size: 15px; font-weight: 700; color: #e8e8f0; margin: 0; font-family: 'Sora', sans-serif; }
  .tut-header-title p  { font-size: 11px; color: #5c5e72; margin: 3px 0 0; }
  .tut-close {
    background: none; border: none; cursor: pointer; color: #5c5e72;
    display: flex; align-items: center; padding: 4px; border-radius: 7px; transition: color .13s;
  }
  .tut-close:hover { color: #e05555; }
  .tut-body { flex: 1; overflow-y: auto; padding: 22px; display: flex; flex-direction: column; gap: 14px; }
  .tut-body::-webkit-scrollbar { width: 3px; }
  .tut-body::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
  .tut-step {
    display: flex; gap: 14px;
    background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08);
    border-radius: 12px; padding: 14px 16px;
    transition: border-color .15s;
  }
  .tut-step:hover { border-color: rgba(200,165,94,0.25); }
  .tut-step-num {
    width: 28px; height: 28px; border-radius: 50%; flex-shrink: 0;
    background: rgba(200,165,94,0.15); border: 1px solid rgba(200,165,94,0.35);
    display: flex; align-items: center; justify-content: center;
    font-size: 12px; font-weight: 700; color: var(--gold);
  }
  .tut-step-content { flex: 1; min-width: 0; }
  .tut-step-title { font-size: 13px; font-weight: 600; color: #e8e8f0; margin-bottom: 4px; }
  .tut-step-desc { font-size: 12px; color: #7a7c96; line-height: 1.65; }
  .tut-step-desc strong { color: #c0c2d8; font-weight: 600; }
  .tut-step-desc code {
    background: rgba(200,165,94,0.1); border: 1px solid rgba(200,165,94,0.2);
    border-radius: 4px; padding: 1px 7px; font-family: 'DM Mono', monospace;
    font-size: 11px; color: var(--gold);
  }
  .tut-link {
    display: inline-flex; align-items: center; gap: 5px;
    color: #5a9fd4; font-size: 12px; text-decoration: none; font-weight: 500;
    transition: color .13s;
  }
  .tut-link:hover { color: #7ab8e8; }
  .tut-warning {
    background: rgba(224,82,82,0.08); border: 1px solid rgba(224,82,82,0.25);
    border-radius: 10px; padding: 12px 14px;
    display: flex; gap: 10px; align-items: flex-start;
    font-size: 12px; color: #e05555; line-height: 1.6;
  }
  .tut-warning strong { font-weight: 700; display: block; margin-bottom: 3px; }
  .tut-footer {
    padding: 16px 22px; border-top: 1px solid rgba(255,255,255,0.08);
    display: flex; align-items: center; justify-content: space-between;
  }
  .tut-footer-note { font-size: 11px; color: #5c5e72; }
  .tut-footer-note span { color: #48bb78; font-weight: 600; }
`;

/* ══════════════════════════════════════════════════════
   UTILITÁRIOS
   ══════════════════════════════════════════════════════ */
function Toast({ msg, type, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div className={`cfg-toast ${type}`}>
      {type === "success" ? <Check size={14} /> : <AlertCircle size={14} />}
      {msg}
    </div>
  );
}

function Toggle({ checked, onChange, disabled }) {
  return (
    <label className="toggle-switch" onClick={e => e.stopPropagation()}>
      <input
        type="checkbox" checked={checked}
        onChange={e => !disabled && onChange(e.target.checked)}
        disabled={disabled}
      />
      <span className="toggle-track" />
    </label>
  );
}

function PassInput({ value, onChange, placeholder, className }) {
  const [show, setShow] = useState(false);
  return (
    <div className="input-pass-wrap">
      <input
        type={show ? "text" : "password"}
        className={`form-input ${className || ""}`}
        value={value} onChange={onChange} placeholder={placeholder}
      />
      <button className="input-pass-toggle" onClick={() => setShow(s => !s)} type="button">
        {show ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   SEÇÕES
   ══════════════════════════════════════════════════════ */
function SecaoEmpresa({ config, onSave }) {
  const [form, setForm] = useState({
    nomeEmpresa: config?.empresa?.nomeEmpresa || config?.nomeEmpresa || "",
    cnpj:        config?.empresa?.cnpj        || config?.cnpj        || "",
    telefone:    config?.empresa?.telefone    || config?.telefone    || "",
    endereco:    config?.empresa?.endereco    || config?.endereco    || "",
    logo:        config?.empresa?.logo        || config?.logo        || "",
  });
  const [erros, setErros]       = useState({});
  const [salvando, setSalvando] = useState(false);
  const fileRef = useRef();

  useEffect(() => {
    if (!config) return;
    setForm({
      nomeEmpresa: config?.empresa?.nomeEmpresa || "",
      cnpj:        config?.empresa?.cnpj        || "",
      telefone:    config?.empresa?.telefone    || "",
      endereco:    config?.empresa?.endereco    || "",
      logo:        config?.empresa?.logo        || "",
    });
  }, [config]);

  const set = (k, v) => {
    setForm(f => ({ ...f, [k]: v }));
    if (erros[k]) setErros(e => ({ ...e, [k]: "" }));
  };

  const validarEmpresa = () => {
    const e = {};
    if (form.cnpj?.trim()) {
      const clean = form.cnpj.replace(/\D/g, "");
      if      (clean.length === 11 && !validarCPF(clean))  e.cnpj = "CPF inválido.";
      else if (clean.length === 14 && !validarCNPJ(clean)) e.cnpj = "CNPJ inválido.";
      else if (clean.length !== 11 && clean.length !== 14) e.cnpj = "CPF (11) ou CNPJ (14 dígitos).";
    }
    setErros(e);
    return Object.keys(e).length === 0;
  };

  const handleLogo = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const MAX_BYTES  = 300 * 1024;   // 300 KB — limite final do base64
    const MAX_DIM    = 1200;          // largura/altura máxima em pixels
    const MIME       = "image/jpeg";  // sempre salva como JPEG para melhor compressão

    const comprimirComCanvas = (src) => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          // 1. Calcular dimensões mantendo proporção
          let { width, height } = img;
          if (width > MAX_DIM || height > MAX_DIM) {
            if (width >= height) { height = Math.round(height * MAX_DIM / width); width = MAX_DIM; }
            else                 { width  = Math.round(width  * MAX_DIM / height); height = MAX_DIM; }
          }

          const canvas = document.createElement("canvas");
          canvas.width  = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          // Fundo branco para imagens com transparência (PNG → JPEG)
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);

          // 2. Tentar qualidades decrescentes até caber em 300 KB
          const tentativas = [0.92, 0.85, 0.78, 0.70, 0.60, 0.50, 0.40];
          for (const q of tentativas) {
            const dataUrl = canvas.toDataURL(MIME, q);
            // base64 overhead: cada 4 chars = 3 bytes
            const bytes = Math.ceil((dataUrl.length - dataUrl.indexOf(",") - 1) * 3 / 4);
            if (bytes <= MAX_BYTES) { resolve(dataUrl); return; }
          }
          // Se ainda não couber na qualidade mínima, retorna mesmo assim
          resolve(canvas.toDataURL(MIME, 0.40));
        };
        img.onerror = reject;
        img.src = src;
      });
    };

    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const comprimida = await comprimirComCanvas(ev.target.result);
        set("logo", comprimida);
      } catch {
        alert("Não foi possível processar a imagem. Tente outro arquivo.");
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSalvar = async () => {
    if (!validarEmpresa()) return;
    setSalvando(true);
    try {
      await onSave({ empresa: form });
    } finally {
      setSalvando(false);
    }
  };
  return (
    <div className="cfg-card">
      <div className="cfg-card-header">
        <div className="cfg-card-header-icon"><Building2 size={15} /></div>
        <div>
          <div className="cfg-card-title">Dados da Empresa</div>
          <div className="cfg-card-sub">Informações exibidas em documentos e recibos</div>
        </div>
      </div>
      <div className="cfg-card-body">
        <div className="form-group">
          <label className="form-label">Logo da Empresa</label>
          <div
            className={`logo-upload-area ${form.logo ? "has-logo" : ""}`}
            onClick={() => !form.logo && fileRef.current?.click()}
          >
            {form.logo ? (
              <>
                <img src={form.logo} alt="Logo" className="logo-preview" />
                <div className="logo-upload-btn-row">
                  <button className="btn-secondary" style={{ fontSize: 11, padding: "4px 10px" }}
                    onClick={e => { e.stopPropagation(); fileRef.current?.click(); }}>Trocar</button>
                  <button className="btn-logo-remove"
                    onClick={e => { e.stopPropagation(); set("logo", ""); }}>Remover</button>
                </div>
              </>
            ) : (
              <>
                <Camera size={22} color="var(--text-3)" />
                <span className="logo-upload-hint">Clique para enviar a logo<br />PNG, JPEG ou WebP · Compactado automaticamente</span>
              </>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp"
            style={{ display: "none" }} onChange={handleLogo} />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Nome da Empresa</label>
            <input className="form-input" value={form.nomeEmpresa}
              onChange={e => set("nomeEmpresa", e.target.value)} placeholder="Nome ou razão social" />
          </div>
          <div className="form-group">
            <label className="form-label">CNPJ / CPF</label>
            <input className={`form-input ${erros.cnpj ? "err" : ""}`} value={form.cnpj}
              onChange={e => set("cnpj", e.target.value)} placeholder="00.000.000/0001-00" />
            {erros.cnpj && <div className="form-error">{erros.cnpj}</div>}
          </div>
        </div>
        <div className="form-row">
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Telefone</label>
            <input className="form-input" value={form.telefone}
              onChange={e => set("telefone", e.target.value)} placeholder="(62) 99999-9999" />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Endereço</label>
            <input className="form-input" value={form.endereco}
              onChange={e => set("endereco", e.target.value)} placeholder="Rua, número, bairro, cidade" />
          </div>
        </div>
      </div>
      <div className="cfg-card-footer">
        <button className="btn-primary" onClick={handleSalvar} disabled={salvando}>
          {salvando ? <><span className="cfg-spinner" />Salvando...</> : <><Save size={13} />Salvar Empresa</>}
        </button>
      </div>
    </div>
  );
}

function SecaoSeguranca() {
  const [form, setForm]         = useState({ senhaAtual: "", novaSenha: "", confirmar: "" });
  const [erros, setErros]       = useState({});
  const [salvando, setSalvando] = useState(false);
  const [sucesso, setSucesso]   = useState(false);

  const set = (k, v) => {
    setForm(f => ({ ...f, [k]: v }));
    if (erros[k]) setErros(e => ({ ...e, [k]: "" }));
  };

  const validar = () => {
    const e = {};
    if (!form.senhaAtual)                e.senhaAtual = "Informe a senha atual.";
    if (form.novaSenha.length < 6)       e.novaSenha  = "Mínimo 6 caracteres.";
    if (form.novaSenha !== form.confirmar) e.confirmar = "As senhas não conferem.";
    setErros(e);
    return Object.keys(e).length === 0;
  };

  const handleSalvar = async () => {
    if (!validar()) return;
    setSalvando(true); setSucesso(false);
    try {
      const user = auth.currentUser;
      const credential = EmailAuthProvider.credential(user.email, form.senhaAtual);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, form.novaSenha);
      setForm({ senhaAtual: "", novaSenha: "", confirmar: "" });
      setSucesso(true);
      setTimeout(() => setSucesso(false), 4000);
    } catch (err) {
      const isWrongPass = err.code === "auth/wrong-password" || err.code === "auth/invalid-credential";
      setErros({ senhaAtual: isWrongPass ? "Senha atual incorreta." : `Erro: ${err.message}` });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="cfg-card">
      <div className="cfg-card-header">
        <div className="cfg-card-header-icon"><Lock size={15} /></div>
        <div>
          <div className="cfg-card-title">Trocar Senha</div>
          <div className="cfg-card-sub">Autenticação via Firebase — confirme a senha atual</div>
        </div>
      </div>
      <div className="cfg-card-body">
        {sucesso && (
          <div className="cfg-alert" style={{ background: "rgba(72,187,120,0.08)", border: "1px solid rgba(72,187,120,0.3)", color: "#48bb78", marginBottom: 16 }}>
            <Check size={14} style={{ flexShrink: 0 }} />Senha alterada com sucesso!
          </div>
        )}
        <div className="form-group">
          <label className="form-label">Senha Atual <span className="form-label-req">*</span></label>
          <PassInput value={form.senhaAtual} onChange={e => set("senhaAtual", e.target.value)}
            placeholder="Digite sua senha atual" className={erros.senhaAtual ? "err" : ""} />
          {erros.senhaAtual && <div className="form-error">{erros.senhaAtual}</div>}
        </div>
        <div className="form-row">
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Nova Senha <span className="form-label-req">*</span></label>
            <PassInput value={form.novaSenha} onChange={e => set("novaSenha", e.target.value)}
              placeholder="Mínimo 6 caracteres" className={erros.novaSenha ? "err" : ""} />
            {erros.novaSenha && <div className="form-error">{erros.novaSenha}</div>}
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Confirmar Nova Senha <span className="form-label-req">*</span></label>
            <PassInput value={form.confirmar} onChange={e => set("confirmar", e.target.value)}
              placeholder="Repita a nova senha" className={erros.confirmar ? "err" : ""} />
            {erros.confirmar && <div className="form-error">{erros.confirmar}</div>}
          </div>
        </div>
      </div>
      <div className="cfg-card-footer">
        <button className="btn-primary" onClick={handleSalvar} disabled={salvando}>
          {salvando ? <><span className="cfg-spinner" />Alterando...</> : <><Lock size={13} />Alterar Senha</>}
        </button>
      </div>
    </div>
  );
}

const normalizaTaxa = (raw) => {
  let v = String(raw).replace(",", ".").replace(/[^0-9.]/g, "");
  const parts = v.split(".");
  if (parts.length > 2) v = parts[0] + "." + parts.slice(1).join("");
  if (v.includes(".")) {
    const [int, dec] = v.split(".");
    v = int + "." + dec.slice(0, 2);
  }
  return v;
};

const taxaValida = (v) => {
  const n = parseFloat(v);
  return v !== "" && !isNaN(n) && n >= 0;
};

function SecaoFinanceiro({ config, onSave }) {
  const [taxas, setTaxas]       = useState(() => ({ ...TAXAS_DEFAULT, ...(config?.taxas || {}) }));
  const [erros, setErros]       = useState({});
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (config?.taxas) setTaxas(prev => ({ ...TAXAS_DEFAULT, ...config.taxas }));
  }, [config]);

  const setTaxa = (k, raw) => {
    const v = normalizaTaxa(raw);
    setTaxas(t => ({ ...t, [k]: v }));
    if (erros[k]) setErros(e => ({ ...e, [k]: "" }));
  };

  const validar = () => {
    const e = {};
    Object.keys(taxas).forEach(k => { if (!taxaValida(taxas[k])) e[k] = "Inválido"; });
    setErros(e);
    return Object.keys(e).length === 0;
  };

  const handleSalvar = async () => {
    if (!validar()) return;
    const taxasFinais = {};
    Object.keys(taxas).forEach(k => { taxasFinais[k] = parseFloat(parseFloat(taxas[k]).toFixed(2)); });
    setSalvando(true);
    await onSave({ taxas: taxasFinais });
    setSalvando(false);
  };

  const TaxaRow = ({ chave, label, tipo }) => (
    <tr>
      <td><span className="taxa-bandeira">{label}</span></td>
      <td><span className="taxa-tipo-badge">{tipo}</span></td>
      <td style={{ textAlign: "right" }}>
        <span style={{ display: "inline-flex", alignItems: "center" }}>
          <input className={`taxa-input ${erros[chave] ? "err" : ""}`} value={taxas[chave] ?? ""} onChange={e => setTaxa(chave, e.target.value)} inputMode="decimal" />
          <span className="taxa-pct">%</span>
        </span>
      </td>
    </tr>
  );

  return (
    <div className="cfg-card">
      <div className="cfg-card-header">
        <div className="cfg-card-header-icon"><CreditCard size={15} /></div>
        <div>
          <div className="cfg-card-title">Taxa de Máquina de Cartão</div>
          <div className="cfg-card-sub">Usada para calcular lucro líquido nas vendas</div>
        </div>
      </div>
      <div className="cfg-card-body" style={{ padding: 0 }}>
        <table className="taxa-table">
          <thead><tr><th>Modalidade</th><th>Tipo</th><th style={{ textAlign: "right" }}>Taxa (%)</th></tr></thead>
          <tbody>
            <tr className="taxa-section-divider"><td colSpan={3}>Outros</td></tr>
            <TaxaRow chave="debito" label="Débito" tipo="Débito" />
            <TaxaRow chave="pix"    label="PIX"    tipo="PIX"    />
            <tr className="taxa-section-divider"><td colSpan={3}>Crédito</td></tr>
            {Array.from({ length: 12 }, (_, i) => i + 1).map(n => (
              <TaxaRow key={n} chave={`credito_${n}`} label={`Crédito ${n}x`} tipo="Crédito" />
            ))}
          </tbody>
        </table>
      </div>
      <div className="cfg-card-footer">
        <button className="btn-primary" onClick={handleSalvar} disabled={salvando}>
          {salvando ? <><span className="cfg-spinner" />Salvando...</> : <><Save size={13} />Salvar Taxas</>}
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   MODAL TUTORIAL — Como cadastrar API de pagamento
   ══════════════════════════════════════════════════════ */
function ModalTutorialPagamento({ onClose }) {
  const PASSOS = [
    {
      titulo: "Crie uma conta no Mercado Pago",
      desc: <>Acesse <a className="tut-link" href="https://www.mercadopago.com.br" target="_blank" rel="noreferrer">mercadopago.com.br <ExternalLink size={10} /></a> e crie sua conta de <strong>pessoa jurídica (empresa)</strong> ou pessoa física. Uma conta de vendedor é necessária para receber pagamentos PIX automáticos.</>,
    },
    {
      titulo: "Acesse o Painel do Desenvolvedor",
      desc: <>Após logar, vá em <strong>Meu Perfil</strong> → <strong>Seu negócio</strong> → <strong>Configurações</strong> → <strong>Gestão e Administração</strong> → clique em <strong>"Credenciais"</strong>. Ou acesse diretamente: <a className="tut-link" href="https://www.mercadopago.com.br/developers/panel/app" target="_blank" rel="noreferrer">painel de aplicações <ExternalLink size={10} /></a>.</>,
    },
    {
      titulo: "Crie uma Aplicação",
      desc: <>No painel de desenvolvedor, clique em <strong>"Criar aplicação"</strong>. Dê um nome como <em>"ASSENT Gestão"</em>, selecione <strong>Pagamentos online</strong> como produto e confirme a criação.</>,
    },
    {
      titulo: "Acesse as Credenciais de Produção",
      desc: <>Dentro da sua aplicação, vá na aba <strong>"Credenciais de produção"</strong>. <br/><br/>⚠️ <strong>Não use as credenciais de teste</strong> (sandbox) — elas não processam pagamentos reais. Use sempre as credenciais de <strong>produção</strong>.</>,
    },
    {
      titulo: "Copie o Access Token",
      desc: <>Localize o campo <strong>"Access Token"</strong> de produção — começa com <code>APP_USR-</code> seguido de uma longa sequência de caracteres. Clique em <strong>Copiar</strong> e cole no campo da tela anterior.</>,
    },
    {
      titulo: "Ative e Salve no ASSENT",
      desc: <>Cole o token no campo <strong>"Access Token de Produção"</strong>, ative o toggle <strong>"Ativar Pagamentos PIX"</strong> e clique em <strong>Salvar</strong>. A partir daí, o PDV terá o botão <strong>"Pagar com Pix QR Code"</strong> disponível.</>,
    },
    {
      titulo: "Habilite o PIX na sua conta MP",
      desc: <>Para receber via PIX, sua conta Mercado Pago precisa ter a chave PIX configurada. Acesse <strong>Configurações</strong> → <strong>PIX</strong> dentro do app Mercado Pago e cadastre sua chave (CPF, CNPJ, e-mail ou telefone).</>,
    },
  ];

  return (
    <div className="tut-overlay" onClick={onClose}>
      <div className="tut-modal" onClick={e => e.stopPropagation()}>
        <div className="tut-header">
          <div className="tut-header-icon"><BookOpen size={16} /></div>
          <div className="tut-header-title">
            <h3>Como cadastrar a API de Pagamento</h3>
            <p>Passo a passo para integrar o Mercado Pago ao PDV</p>
          </div>
          <button className="tut-close" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="tut-body">
          <div className="tut-warning">
            <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              <strong>Somente Administradores têm acesso</strong>
              Esta configuração é restrita ao cargo de Admin do sistema. O Access Token dá acesso à sua conta de recebimentos — mantenha-o seguro e nunca compartilhe.
            </div>
          </div>

          {PASSOS.map((p, i) => (
            <div key={i} className="tut-step">
              <div className="tut-step-num">{i + 1}</div>
              <div className="tut-step-content">
                <div className="tut-step-title">{p.titulo}</div>
                <div className="tut-step-desc">{p.desc}</div>
              </div>
            </div>
          ))}

          <div className="tut-warning" style={{ background: "rgba(72,187,120,0.07)", borderColor: "rgba(72,187,120,0.25)", color: "#48bb78" }}>
            <CheckCircle2 size={15} style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              <strong>Outros provedores</strong>
              Futuramente serão suportados PagSeguro, Pagar.me e outros. Se você usa outro provedor, entre em contato com o suporte ASSENT.
            </div>
          </div>
        </div>

        <div className="tut-footer">
          <span className="tut-footer-note">
            Dúvidas? Documentação oficial: <span>developers.mercadopago.com</span>
          </span>
          <button className="btn-primary" onClick={onClose}>
            <Check size={13} /> Entendi
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   SEÇÃO PAGAMENTOS ONLINE — somente admin
   Salva em: users/{uid}/config/geral → pagamentos.mercadopago
   ══════════════════════════════════════════════════════ */
function SecaoPagamentos({ config, onSave }) {
  const [token,     setToken]     = useState(config?.pagamentos?.mercadopago?.accessToken || "");
  const [ativo,     setAtivo]     = useState(config?.pagamentos?.mercadopago?.ativo ?? false);
  const [showToken, setShowToken] = useState(false);
  const [salvando,  setSalvando]  = useState(false);
  const [testando,  setTestando]  = useState(false);
  const [testeOk,   setTesteOk]   = useState(null); // null | true | false
  const [showTutorial, setShowTutorial] = useState(false);
  const [copiado,   setCopiado]   = useState(false);

  useEffect(() => {
    setToken(config?.pagamentos?.mercadopago?.accessToken || "");
    setAtivo(config?.pagamentos?.mercadopago?.ativo ?? false);
  }, [config]);

  const handleSalvar = async () => {
    if (!token.trim()) { alert("Informe o Access Token antes de salvar."); return; }
    setSalvando(true);
    setTesteOk(null);
    try {
      await onSave({
        pagamentos: {
          mercadopago: {
            accessToken: token.trim(),
            ativo,
            atualizadoEm: new Date().toISOString(),
          }
        }
      });
    } finally {
      setSalvando(false);
    }
  };

  const handleTestar = async () => {
    if (!token.trim()) return;
    setTestando(true);
    setTesteOk(null);
    try {
      // Chama endpoint simples para validar o token
      const res = await fetch("https://api.mercadopago.com/v1/payment_methods?marketplace=NONE&site_id=MLB", {
        headers: { "Authorization": `Bearer ${token.trim()}` }
      });
      setTesteOk(res.ok);
    } catch {
      setTesteOk(false);
    } finally {
      setTestando(false);
    }
  };

  const handleCopiar = () => {
    if (!token) return;
    navigator.clipboard.writeText(token).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    });
  };

  const tokenMascarado = token
    ? token.slice(0, 12) + "••••••••••••••••••••••" + token.slice(-6)
    : "";

  return (
    <>
      {showTutorial && <ModalTutorialPagamento onClose={() => setShowTutorial(false)} />}

      <div className="cfg-card">
        <div className="cfg-card-header">
          <div className="cfg-card-header-icon"><Zap size={15} /></div>
          <div>
            <div className="cfg-card-title">Pagamentos Online</div>
            <div className="cfg-card-sub">Configuração de APIs de pagamento para QR Code PIX</div>
          </div>
        </div>

        <div className="cfg-card-body" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Aviso admin-only */}
          <div className="pag-info-box">
            <strong>🔒 Área restrita ao Administrador.</strong> O Access Token dá acesso direto à sua conta de recebimentos do Mercado Pago. Nunca compartilhe este token com terceiros. Mantenha-o confidencial como uma senha bancária.
          </div>

          {/* Botão tutorial */}
          <button className="pag-btn-tutorial" onClick={() => setShowTutorial(true)}>
            <BookOpen size={14} />
            Tutorial para cadastrar API de pagamento
            <ChevronRight size={13} />
          </button>

          {/* Card Mercado Pago */}
          <div className={`pag-provedor-card ${ativo && token ? "ativo" : ""}`}>
            <div className="pag-provedor-header">
              <div className="pag-provedor-logo" title="Mercado Pago">
                <span style={{ fontSize: 18 }}>💳</span>
              </div>
              <div className="pag-provedor-info">
                <div className="pag-provedor-nome">Mercado Pago</div>
                <div className="pag-provedor-sub">PIX · QR Code · Pagamento instantâneo</div>
              </div>
              <div className="pag-provedor-badge" style={ativo && token ? {} : { background: "var(--s3)", color: "var(--text-3)", borderColor: "var(--border)" }}>
                {ativo && token ? "Ativo" : "Inativo"}
              </div>
            </div>

            <div className="pag-provedor-body">
              {/* Toggle ativar */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>Ativar Pagamentos PIX</div>
                  <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>Exibe o botão "Pagar com Pix QR Code" no PDV</div>
                </div>
                <Toggle checked={ativo} onChange={setAtivo} />
              </div>

              {/* Access Token */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">
                  Access Token de Produção <span className="form-label-req">*</span>
                </label>
                <div className="pag-token-wrap">
                  <input
                    type={showToken ? "text" : "password"}
                    className="form-input"
                    style={{ fontFamily: "'DM Mono','Courier New',monospace", fontSize: 12 }}
                    value={token}
                    onChange={e => { setToken(e.target.value); setTesteOk(null); }}
                    placeholder="APP_USR-xxxxxxxxxxxxxxxxxxxx-xxxxxx-xxxxxxxxxxxxxxxxx-xxxxxxxxxx"
                  />
                  <button
                    className="pag-token-toggle"
                    onClick={() => setShowToken(s => !s)}
                    type="button"
                    title={showToken ? "Ocultar token" : "Exibir token"}
                  >
                    {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button
                    className="btn-secondary"
                    style={{ fontSize: 11, padding: "5px 12px", display: "flex", alignItems: "center", gap: 6 }}
                    onClick={handleTestar}
                    disabled={!token.trim() || testando}
                  >
                    {testando
                      ? <><span className="cfg-spinner" />Testando...</>
                      : testeOk === true
                        ? <><Check size={12} color="#48bb78" />Token válido</>
                        : testeOk === false
                          ? <><AlertCircle size={12} color="var(--red)" />Token inválido</>
                          : <>Testar conexão</>
                    }
                  </button>
                  <button
                    className="btn-secondary"
                    style={{ fontSize: 11, padding: "5px 12px", display: "flex", alignItems: "center", gap: 6 }}
                    onClick={handleCopiar}
                    disabled={!token}
                  >
                    <Copy size={11} />
                    {copiado ? "Copiado!" : "Copiar token"}
                  </button>
                </div>
              </div>

              {/* Status indicator */}
              <div className="pag-status-row">
                <div className={`pag-status-dot ${testeOk === true ? "ok" : testeOk === false ? "erro" : ""}`} />
                <div className="pag-status-text">
                  {testeOk === true
                    ? "✅ Conexão bem-sucedida com o Mercado Pago"
                    : testeOk === false
                      ? "❌ Token inválido ou sem permissão de acesso"
                      : token
                        ? "Clique em 'Testar conexão' para validar o token"
                        : "Nenhum token configurado"
                  }
                </div>
              </div>
            </div>
          </div>

          {/* Info sobre como funciona */}
          <div className="pag-info-box">
            <strong>Como funciona:</strong> Ao ativar, o PDV exibirá o botão <strong>"Pagar com Pix QR Code"</strong>. O sistema gera um QR Code via API do Mercado Pago com o valor exato da venda. Quando o cliente escanear e pagar, a venda é <strong>finalizada automaticamente</strong> sem intervenção manual.
          </div>
        </div>

        <div className="cfg-card-footer">
          <button className="btn-primary" onClick={handleSalvar} disabled={salvando || !token.trim()}>
            {salvando ? <><span className="cfg-spinner" />Salvando...</> : <><Save size={13} />Salvar Configuração</>}
          </button>
        </div>
      </div>
    </>
  );
}


  const base = {};
  MENU_SECTIONS.forEach(s => {
    base[s.key] = s.locked ? true : (cfg?.menuVisivel?.[s.key] !== undefined ? cfg.menuVisivel[s.key] : true);
  });
  return base;


function SecaoMenu({ config, onSave }) {
  const [visivel, setVisivel]   = useState(() => buildVisivel(config));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro]         = useState("");

  useEffect(() => { if (config !== null) setVisivel(buildVisivel(config)); }, [config]);

  const toggle = useCallback((key, val) => {
    setVisivel(prev => ({ ...prev, [key]: val }));
    setErro("");
  }, []);

  const handleSalvar = async () => {
    setSalvando(true); setErro("");
    try {
      const menuVisivel = {};
      MENU_SECTIONS.forEach(s => { if (!s.locked) menuVisivel[s.key] = visivel[s.key]; });
      await onSave({ menuVisivel });
    } catch { setErro("Falha ao salvar. Verifique sua conexão."); }
    finally { setSalvando(false); }
  };

  return (
    <div className="cfg-card">
      <div className="cfg-card-header">
        <div className="cfg-card-header-icon"><LayoutDashboard size={15} /></div>
        <div><div className="cfg-card-title">Visibilidade do Menu</div><div className="cfg-card-sub">Oculte seções que não utiliza</div></div>
      </div>
      <div className="cfg-card-body">
        <div className="menu-toggle-list">
          {MENU_SECTIONS.map(s => (
            <div key={s.key} className="menu-toggle-item">
              <div className="menu-toggle-icon">{s.icon}</div>
              <div style={{ flex: 1 }}><div className="menu-toggle-label">{s.label}</div><div className="menu-toggle-sub">{s.sub}</div></div>
              {s.locked ? <span className="menu-toggle-locked">Sempre visível</span> : <Toggle checked={!!visivel[s.key]} onChange={val => toggle(s.key, val)} />}
            </div>
          ))}
        </div>
      </div>
      <div className="cfg-card-footer"><button className="btn-primary" onClick={handleSalvar} disabled={salvando}>{salvando ? <><span className="cfg-spinner" />Salvando...</> : <><Save size={13} />Salvar Menu</>}</button></div>
    </div>
  );
}

function SecaoEstoque({ config, onSave }) {
  const [minimo, setMinimo]     = useState(config?.estoqueMinimo ?? 5);
  const [salvando, setSalvando] = useState(false);
  useEffect(() => { if (config?.estoqueMinimo !== undefined) setMinimo(config.estoqueMinimo); }, [config]);
  const handleSalvar = async () => { setSalvando(true); await onSave({ estoqueMinimo: Number(minimo) }); setSalvando(false); };
  return (
    <div className="cfg-card">
      <div className="cfg-card-header">
        <div className="cfg-card-header-icon"><Package size={15} /></div>
        <div><div className="cfg-card-title">Estoque Mínimo Padrão</div><div className="cfg-card-sub">Alertas quando o limite for atingido</div></div>
      </div>
      <div className="cfg-card-body">
        <div className="form-group"><label className="form-label">Quantidade mínima padrão</label><div style={{ display: "flex", alignItems: "center", gap: 10 }}><input type="number" min="0" className="form-input" style={{ maxWidth: 160 }} value={minimo} onChange={e => setMinimo(e.target.value)} /><span style={{ fontSize: 12, color: "var(--text-3)" }}>unidades</span></div></div>
      </div>
      <div className="cfg-card-footer"><button className="btn-primary" onClick={handleSalvar} disabled={salvando}>{salvando ? <><span className="cfg-spinner" />Salvando...</> : <><Save size={13} />Salvar Estoque</>}</button></div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   SEÇÃO ATALHOS — informativa, preparada para expansão
   ══════════════════════════════════════════════════════ */
function SecaoAtalhos({ menuVisivel = {} }) {
  return (
    <div className="cfg-card">
      <div className="cfg-card-header">
        <div className="cfg-card-header-icon"><Keyboard size={15} /></div>
        <div>
          <div className="cfg-card-title">Atalhos de Teclado</div>
          <div className="cfg-card-sub">Navegue rapidamente usando o teclado</div>
        </div>
      </div>
      <div className="cfg-card-body">
        <div className="atalhos-intro">
          Use <strong>Alt + tecla</strong> para saltar diretamente para qualquer módulo.{" "}
          Atalhos são desativados automaticamente quando você está digitando em um campo.
          Módulos ocultos no menu não respondem ao atalho.
        </div>
        <div className="atalhos-list">
          {ATALHOS_MAP.map(({ code, display, key, hint }) => {
            const section = MENU_SECTIONS.find(s => s.key === key);
            if (!section) return null;
            const ativo = section.locked || menuVisivel[key] !== false;
            return (
              <div key={code} className={`atalho-item${ativo ? "" : " atalho-disabled"}`}>
                <div className="atalho-icon">{section.icon}</div>
                <div className="atalho-info">
                  <div className="atalho-label">{section.label}</div>
                  <div className="atalho-sub">{hint}</div>
                </div>
                <kbd className="atalho-key">{display}</kbd>
                {!ativo && <span className="atalho-hidden-badge">Oculto no menu</span>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   SEÇÃO LOG DE ATIVIDADES — somente admin
   Firestore: users/{tenantUid}/logs (orderBy criadoEm desc)
   ══════════════════════════════════════════════════════ */
const PAGE_SIZE = 30;

const MODULOS_LOG = [
  "Todos", "Agenda", "A Receber", "Caixa Diário", "Clientes",
  "Compras", "Configurações", "Despesas", "Entrada de Estoque",
  "Fornecedores", "Matrículas", "Mesas", "Orçamentos", "PDV", "Produtos",
  "Serviços", "Usuários", "Vendas", "Vendedores",
];

const ACOES_LOG = ["Todas", "criar", "editar", "excluir"];

function fmtDataLog(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString("pt-BR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
}

function SecaoLog({ tenantUid }) {
  // Todos os logs brutos do Firestore — sem where, sem índice composto
  const [todosLogs, setTodosLogs]     = useState([]);
  const [carregando, setCarregando]   = useState(true);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [ultimoDoc, setUltimoDoc]     = useState(null);
  const [temMais, setTemMais]         = useState(false);

  // Filtros e busca — todos aplicados no cliente
  const [busca, setBusca]             = useState("");
  const [filtroAcao, setFiltroAcao]   = useState("Todas");
  const [filtroModulo, setFiltroModulo] = useState("Todos");

  // Busca apenas por criadoEm desc — sem where, sem índice composto
  const carregarLogs = useCallback(async (resetar = true) => {
    if (!tenantUid) return;
    resetar ? setCarregando(true) : setCarregandoMais(true);

    try {
      let q = query(
        collection(db, "users", tenantUid, "logs"),
        orderBy("criadoEm", "desc"),
        limit(PAGE_SIZE + 1)
      );

      if (!resetar && ultimoDoc) {
        q = query(
          collection(db, "users", tenantUid, "logs"),
          orderBy("criadoEm", "desc"),
          limit(PAGE_SIZE + 1),
          startAfter(ultimoDoc)
        );
      }

      const snap = await getDocs(q);
      const docs = snap.docs;
      const temProximo = docs.length > PAGE_SIZE;
      const fatia = temProximo ? docs.slice(0, PAGE_SIZE) : docs;
      const dados = fatia.map(d => ({ id: d.id, ...d.data() }));

      setTodosLogs(prev => resetar ? dados : [...prev, ...dados]);
      setUltimoDoc(fatia[fatia.length - 1] ?? null);
      setTemMais(temProximo);
    } catch (err) {
      console.error("[SecaoLog] Erro ao carregar logs:", err);
    } finally {
      setCarregando(false);
      setCarregandoMais(false);
    }
  }, [tenantUid, ultimoDoc]);

  useEffect(() => {
    setUltimoDoc(null);
    carregarLogs(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantUid]);

  // Todos os filtros aplicados no cliente — sem índice necessário
  const logsFiltrados = useMemo(() => {
    let lista = todosLogs;

    if (filtroAcao !== "Todas") {
      lista = lista.filter(l => l.acao === filtroAcao);
    }

    if (filtroModulo !== "Todos") {
      lista = lista.filter(l => l.modulo === filtroModulo);
    }

    if (busca.trim()) {
      const q = busca.toLowerCase();
      lista = lista.filter(l =>
        l.descricao?.toLowerCase().includes(q) ||
        l.nomeUsuario?.toLowerCase().includes(q) ||
        l.modulo?.toLowerCase().includes(q) ||
        l.cargo?.toLowerCase().includes(q)
      );
    }

    return lista;
  }, [todosLogs, filtroAcao, filtroModulo, busca]);

  const badgeClass = (acao) => {
    if (acao === "criar")   return "log-acao-badge log-acao-criar";
    if (acao === "editar")  return "log-acao-badge log-acao-editar";
    if (acao === "excluir") return "log-acao-badge log-acao-excluir";
    return "log-acao-badge log-acao-editar";
  };

  return (
    <div className="cfg-card">
      <div className="cfg-card-header">
        <div className="cfg-card-header-icon"><Activity size={15} /></div>
        <div>
          <div className="cfg-card-title">Log de Atividades</div>
          <div className="cfg-card-sub">Histórico de ações realizadas no sistema</div>
        </div>
      </div>

      <div className="cfg-card-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Toolbar */}
        <div className="log-toolbar">
          <div className="log-search-wrap">
            <Search size={13} color="var(--text-3)" />
            <input
              className="log-search-input"
              placeholder="Buscar por ação, usuário ou módulo..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
            />
          </div>

          <select
            className="log-select"
            value={filtroAcao}
            onChange={e => { setFiltroAcao(e.target.value); setUltimoDoc(null); }}
          >
            {ACOES_LOG.map(a => (
              <option key={a} value={a}>
                {a === "Todas" ? "Todas as ações" : a.charAt(0).toUpperCase() + a.slice(1)}
              </option>
            ))}
          </select>

          <select
            className="log-select"
            value={filtroModulo}
            onChange={e => { setFiltroModulo(e.target.value); setUltimoDoc(null); }}
          >
            {MODULOS_LOG.map(m => (
              <option key={m} value={m}>
                {m === "Todos" ? "Todos os módulos" : m}
              </option>
            ))}
          </select>

          <button
            className="log-btn-refresh"
            onClick={() => { setUltimoDoc(null); carregarLogs(true); }}
            disabled={carregando}
          >
            <RefreshCw size={13} style={carregando ? { animation: "spin .8s linear infinite" } : {}} />
            Atualizar
          </button>
        </div>

        {/* Lista */}
        {carregando ? (
          <div className="log-loading">
            <span className="cfg-spinner" style={{ border: "2px solid rgba(200,165,94,0.2)", borderTopColor: "var(--gold)" }} />
            Carregando logs...
          </div>
        ) : logsFiltrados.length === 0 ? (
          <div className="log-empty">
            {busca.trim() ? "Nenhum resultado para esta busca." : "Nenhuma atividade registrada ainda."}
          </div>
        ) : (
          <>
            <div className="log-list">
              {logsFiltrados.map(log => (
                <div key={log.id} className="log-item">
                  <span className={badgeClass(log.acao)}>
                    {log.acao || "—"}
                  </span>
                  <div className="log-info">
                    <div className="log-desc">{log.descricao || "—"}</div>
                    <div className="log-meta">
                      <span className="log-modulo-badge">{log.modulo || "—"}</span>
                      <span className="log-meta-dot">·</span>
                      <span className="log-meta-item">{log.nomeUsuario || "—"}</span>
                      {log.cargo && (
                        <>
                          <span className="log-meta-dot">·</span>
                          <span className="log-meta-item" style={{ textTransform: "capitalize" }}>{log.cargo}</span>
                        </>
                      )}
                      <span className="log-meta-dot">·</span>
                      <span className="log-meta-item">{fmtDataLog(log.timestamp)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {temMais && !busca.trim() && (
              <button
                className="log-load-more"
                onClick={() => carregarLogs(false)}
                disabled={carregandoMais}
              >
                {carregandoMais
                  ? <><span className="cfg-spinner" style={{ border: "2px solid rgba(200,165,94,0.2)", borderTopColor: "var(--gold)" }} />Carregando...</>
                  : <>Carregar mais</>
                }
              </button>
            )}

            <div className="log-count-bar">
              {logsFiltrados.length} {logsFiltrados.length === 1 ? "registro" : "registros"} exibidos
              {(filtroAcao !== "Todas" || filtroModulo !== "Todos" || busca.trim()) && todosLogs.length > 0 &&
                ` (de ${todosLogs.length} carregados)`
              }
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
   ══════════════════════════════════════════════════════ */
/* ─────────────────────────────────────────────
   Seções visíveis por cargo
───────────────────────────────────────────── */
const SECOES_POR_CARGO = {
  admin:       ["empresa", "seguranca", "financeiro", "pagamentos", "menu", "estoque", "atalhos", "log"],
  financeiro:  ["seguranca", "financeiro", "atalhos"],
  comercial:   ["seguranca", "atalhos"],
  compras:     ["seguranca", "estoque", "atalhos"],
  operacional: ["seguranca", "estoque", "atalhos"],
  vendedor:    ["seguranca", "atalhos"],
  suporte:     ["seguranca", "atalhos"],
};

export default function Configuracoes({ menuVisivel: menuVisivelProp }) {
  // ── Multi-tenant ──
  const { tenantUid, cargo, isAdmin } = useAuth();
  const uid = tenantUid;

  const [config, setConfig]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [secao, setSecao]     = useState(isAdmin ? "empresa" : "seguranca");
  const [toast, setToast]     = useState(null);

  // Seções que este cargo pode ver
  const secoesVisiveis = SECOES_POR_CARGO[cargo] ?? ["seguranca", "atalhos"];
  const navFiltrado    = NAV.filter(n => secoesVisiveis.includes(n.id));

  useEffect(() => {
    if (!uid) { setLoading(false); return; }
    const ref = doc(db, "users", uid, "config", "geral");
    getDoc(ref).then(snap => setConfig(snap.exists() ? snap.data() : {})).catch(() => setConfig({})).finally(() => setLoading(false));
  }, [uid]);

  const handleSave = useCallback(async (partial) => {
    if (!uid) return;
    try {
      await setDoc(doc(db, "users", uid, "config", "geral"), partial, { merge: true });
      setConfig(prev => ({ ...prev, ...partial }));
      setToast({ msg: "Configurações salvas!", type: "success" });
    } catch (err) { setToast({ msg: "Erro ao salvar.", type: "error" }); throw err; }
  }, [uid]);

  const renderSecao = () => {
    if (loading) return <div className="cfg-loading">Carregando configurações...</div>;
    switch (secao) {
      case "empresa":    return <SecaoEmpresa    config={config} onSave={handleSave} />;
      case "seguranca":  return <SecaoSeguranca />;
      case "financeiro": return <SecaoFinanceiro config={config} onSave={handleSave} />;
      case "pagamentos": return <SecaoPagamentos config={config} onSave={handleSave} />;
      case "menu":       return <SecaoMenu       config={config} onSave={handleSave} />;
      case "estoque":    return <SecaoEstoque    config={config} onSave={handleSave} />;
      case "atalhos":    return <SecaoAtalhos    menuVisivel={menuVisivelProp ?? config?.menuVisivel ?? {}} />;
      case "log":        return <SecaoLog        tenantUid={uid} />;
      default:           return null;
    }
  };

  return (
    <>
      <style>{CSS}</style>
      <div className="cfg-root">
        <header className="cfg-topbar">
          <div className="cfg-topbar-title">
            <h1>Configurações</h1>
            <p>Personalize o comportamento e os dados do sistema</p>
          </div>
        </header>

        <div className="cfg-body">
          <nav className="cfg-nav">
            <span className="cfg-nav-group-label">Configurações</span>
            {navFiltrado.filter(n => n.id !== "log").map(({ id, label, icon: Icon }) => (
              <button key={id} className={`cfg-nav-item ${secao === id ? "active" : ""}`} onClick={() => setSecao(id)}>
                <Icon size={15} className="cfg-nav-icon" />
                <span className="cfg-nav-label">{label}</span>
                {secao === id && <ChevronRight size={13} color="var(--text-3)" />}
              </button>
            ))}
            {navFiltrado.some(n => n.id === "log") && (
              <>
                <span className="cfg-nav-group-label" style={{ marginTop: 14 }}>Auditoria</span>
                <button className={`cfg-nav-item ${secao === "log" ? "active" : ""}`} onClick={() => setSecao("log")}>
                  <Activity size={15} className="cfg-nav-icon" />
                  <span className="cfg-nav-label">Log de Atividades</span>
                  {secao === "log" && <ChevronRight size={13} color="var(--text-3)" />}
                </button>
              </>
            )}
          </nav>

          <main className="cfg-panel" key={secao}>
            {renderSecao()}
          </main>
        </div>
      </div>
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </>
  );
}

export function useConfiguracoes(uid) {
  const [config, setConfig]   = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!uid) { setLoading(false); return; }
    getDoc(doc(db, "users", uid, "config", "geral")).then(snap => setConfig(snap.exists() ? snap.data() : {})).catch(() => setConfig({})).finally(() => setLoading(false));
  }, [uid]);
  return {
    config, loading,
    taxas: { ...TAXAS_DEFAULT, ...(config?.taxas || {}) },
    estoqueMinimo: config?.estoqueMinimo ?? 5,
    menuVisivel: config?.menuVisivel || {},
    empresa: config?.empresa || { nomeEmpresa: config?.nomeEmpresa || "", cnpj: config?.cnpj || "", telefone: config?.telefone || "", endereco: config?.endereco || "", logo: config?.logo || "" },
  };
}
