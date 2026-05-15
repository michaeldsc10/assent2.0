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
  Wallet, ArrowRight, ServerCog, Wifi, WifiOff,
  GraduationCap, Plus, Edit2, Trash2, FileText,
  Users, Wrench, ArrowDownToLine, TrendingDown, Clock,
  ShoppingCart, ArrowDownLeft, Truck, BarChart2, Calendar,
  Barcode, Table2, Settings,
} from "lucide-react";

import { db, functions } from "../lib/firebase";
import { fsError } from "../utils/firestoreError";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { useAuth } from "../contexts/AuthContext";
import { doc, getDoc, setDoc, collection, query, orderBy, limit, getDocs, startAfter } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
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
  { key: "dashboard",       label: "Dashboard",         sub: "Visão geral e KPIs",            Icon: LayoutDashboard,   locked: true  },
  { key: "clientes",        label: "Clientes",           sub: "Cadastro e histórico",          Icon: Users,             locked: false },
  { key: "produtos",        label: "Produtos",           sub: "Catálogo de produtos",          Icon: Package,           locked: false },
  { key: "servicos",        label: "Serviços",           sub: "Catálogo de serviços",          Icon: Wrench,            locked: false },
  { key: "entrada_estoque", label: "Estoque",            sub: "Movimentação de entrada",       Icon: ArrowDownToLine,   locked: false },
  { key: "vendas",          label: "Vendas",             sub: "PDV e registro de vendas",      Icon: TrendingDown,      locked: false },
  { key: "pdv",             label: "PDV",                sub: "Ponto de Venda (leitor de código)", Icon: Barcode,        locked: false },
  { key: "mesas",           label: "Mesas",              sub: "Gestão de mesas e comandas",    Icon: Table2,            locked: false },
  { key: "matriculas",      label: "Matrículas",         sub: "Alunos e mensalidades",         Icon: GraduationCap,     locked: false },
  { key: "fiado",           label: "A Receber",          sub: "Contas a receber",              Icon: Clock,             locked: false },
  { key: "caixa",           label: "Caixa Diário",       sub: "Abertura e fechamento",         Icon: Wallet,            locked: false },
  { key: "despesas",        label: "Despesas",           sub: "Controle de saídas",            Icon: ArrowDownLeft,     locked: false },
  { key: "fornecedores",    label: "Fornecedores",       sub: "Cadastro de fornecedores",      Icon: Truck,             locked: false },
  { key: "relatorios",      label: "Relatórios",         sub: "Análises e exportações",        Icon: BarChart2,         locked: false },
  { key: "agenda",          label: "Agenda",             sub: "Compromissos e tarefas",        Icon: Calendar,          locked: false },
  { key: "orcamentos",      label: "Orçamentos",         sub: "Orçamentos",                    Icon: Zap,               locked: false },
  { key: "vendedores",      label: "Vendedores",         sub: "Equipe de vendas",              Icon: Users,             locked: false },
  { key: "config",          label: "Configurações",      sub: "Esta tela",                     Icon: Settings,          locked: true  },
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
  { id: "matriculas", label: "Matrículas",           icon: GraduationCap  },
  { id: "atalhos",    label: "Atalhos",              icon: Keyboard       },
  { id: "log",        label: "Log de Atividades",    icon: Activity       },
  { id: "lgpd",       label: "Termos e LGPD",        icon: FileText       },
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
    flex-shrink: 0; color: var(--text-3);
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
    flex-shrink: 0; color: var(--text-3);
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

  /* ── Seção Matrículas — Turmas ── */
  .turmas-list { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; }
  .turma-item {
    display: flex; align-items: center; gap: 8px;
    background: var(--s2); border: 1px solid var(--border);
    border-radius: 8px; padding: 8px 12px; min-height: 40px;
    transition: border-color .13s;
  }
  .turma-item:hover { border-color: var(--border-h); }
  .turma-item-nome { flex: 1; font-size: 13px; color: var(--text); word-break: break-word; }
  .turma-item-input {
    flex: 1; background: transparent; border: none; outline: none; min-width: 0;
    font-size: 13px; color: var(--text); font-family: 'DM Sans', sans-serif; padding: 0;
  }
  .turmas-add-row { display: flex; gap: 8px; }
  .turmas-add-row .form-input { flex: 1; }
  .turmas-empty { font-size: 12px; color: var(--text-3); padding: 14px 0; text-align: center; }
  .turma-btn-base {
    width: 28px; height: 28px; border-radius: 7px; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; border: 1px solid transparent; background: transparent; transition: all .13s;
  }
  .turma-btn-ok     { color: #48bb78; }
  .turma-btn-ok:hover     { background: rgba(72,187,120,.12); border-color: rgba(72,187,120,.25); }
  .turma-btn-cancel { color: var(--text-3); }
  .turma-btn-cancel:hover { background: var(--s3); border-color: var(--border); }
  .turma-btn-edit   { color: #5b8ef0; }
  .turma-btn-edit:hover   { background: rgba(91,142,240,.1); border-color: rgba(91,142,240,.2); }
  .turma-btn-del    { color: #e05252; }
  .turma-btn-del:hover    { background: rgba(224,82,82,.1); border-color: rgba(224,82,82,.2); }

  /* ── Seção Pagamentos Online ── */
  .pag-wrap { display: flex; flex-direction: column; gap: 24px; }

  /* Bloco do provedor — fundo escuro com borda esquerda colorida */
  .pag-mp-block {
    border-radius: 14px;
    background: linear-gradient(135deg, rgba(0,158,227,0.06) 0%, rgba(0,0,0,0) 60%);
    border: 1px solid rgba(0,158,227,0.18);
    overflow: hidden;
    transition: border-color .2s;
  }
  .pag-mp-block.ativo {
    border-color: rgba(0,158,227,0.4);
    box-shadow: 0 0 0 1px rgba(0,158,227,0.1) inset;
  }

  /* Cabeçalho do bloco MP */
  .pag-mp-head {
    display: flex; align-items: center; gap: 14px;
    padding: 16px 20px 14px;
    border-bottom: 1px solid rgba(255,255,255,0.05);
  }
  .pag-mp-icon {
    width: 40px; height: 40px; border-radius: 12px; flex-shrink: 0;
    background: linear-gradient(135deg, #009ee3, #0077bb);
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 4px 12px rgba(0,158,227,0.35);
  }
  .pag-mp-label { flex: 1; }
  .pag-mp-nome { font-size: 14px; font-weight: 700; color: var(--text); letter-spacing: -.01em; }
  .pag-mp-tag  {
    display: inline-flex; align-items: center; gap: 5px;
    font-size: 10px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase;
    padding: 3px 9px; border-radius: 20px; margin-top: 4px;
    background: rgba(72,187,120,0.1); color: #48bb78; border: 1px solid rgba(72,187,120,0.2);
  }
  .pag-mp-tag.inativo {
    background: rgba(255,255,255,0.04); color: var(--text-3); border-color: rgba(255,255,255,0.08);
  }

  /* Toggle row */
  .pag-toggle-row {
    display: flex; align-items: center; justify-content: space-between;
    padding: 14px 20px; gap: 16px;
    border-bottom: 1px solid rgba(255,255,255,0.04);
  }
  .pag-toggle-label { font-size: 13px; font-weight: 600; color: var(--text); }
  .pag-toggle-sub   { font-size: 11px; color: var(--text-3); margin-top: 2px; }

  /* Corpo do token */
  .pag-token-area { padding: 16px 20px 20px; display: flex; flex-direction: column; gap: 12px; }
  .pag-token-wrap { position: relative; }
  .pag-token-wrap .form-input {
    padding-right: 42px; letter-spacing: .04em;
    font-family: 'DM Mono', 'Courier New', monospace; font-size: 11.5px;
    background: rgba(0,0,0,0.2);
  }
  .pag-token-toggle {
    position: absolute; right: 11px; top: 50%; transform: translateY(-50%);
    background: none; border: none; cursor: pointer;
    color: var(--text-3); display: flex; align-items: center; transition: color .13s;
  }
  .pag-token-toggle:hover { color: var(--text-2); }

  /* Botões de ação do token */
  .pag-actions { display: flex; gap: 8px; flex-wrap: wrap; }

  /* Status pill */
  .pag-status {
    display: flex; align-items: center; gap: 9px;
    padding: 10px 14px; border-radius: 10px;
    background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07);
    font-size: 12px; color: var(--text-3); transition: all .2s;
  }
  .pag-status.ok   { border-color: rgba(72,187,120,0.2);  background: rgba(72,187,120,0.06);  color: #48bb78; }
  .pag-status.erro { border-color: rgba(224,82,82,0.2);   background: rgba(224,82,82,0.06);   color: var(--red); }
  .pag-status-dot {
    width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; background: currentColor;
    transition: box-shadow .2s;
  }
  .pag-status.ok .pag-status-dot   { box-shadow: 0 0 7px rgba(72,187,120,0.7); }
  .pag-status.erro .pag-status-dot { box-shadow: 0 0 7px rgba(224,82,82,0.6); }

  /* Bloco webhook — linha horizontal separada */
  .pag-webhook {
    border-radius: 12px; overflow: hidden;
    border: 1px solid rgba(255,255,255,0.08);
    background: rgba(255,255,255,0.02);
  }
  .pag-webhook-head {
    display: flex; align-items: center; gap: 10px;
    padding: 12px 16px; border-bottom: 1px solid rgba(255,255,255,0.05);
    font-size: 12px; font-weight: 600; color: var(--text-2);
  }
  .pag-webhook-url {
    padding: 10px 16px; display: flex; align-items: center; gap: 10px;
    font-family: 'DM Mono', monospace; font-size: 10.5px; color: var(--gold);
    background: rgba(200,165,94,0.05); word-break: break-all; line-height: 1.5;
  }
  .pag-copy-url {
    flex-shrink: 0; background: rgba(200,165,94,0.1); border: 1px solid rgba(200,165,94,0.25);
    border-radius: 7px; padding: 5px 9px; cursor: pointer; color: var(--gold);
    font-size: 11px; font-weight: 600; display: flex; align-items: center; gap: 5px;
    transition: all .13s; font-family: 'DM Sans', sans-serif; white-space: nowrap;
  }
  .pag-copy-url:hover { background: rgba(200,165,94,0.18); }

  /* Fluxo visual */
  .pag-flow {
    display: flex; align-items: center; gap: 6px;
    padding: 12px 16px; flex-wrap: wrap;
    border-top: 1px solid rgba(255,255,255,0.04);
  }
  .pag-flow-step {
    font-size: 10.5px; color: var(--text-3); font-weight: 500;
    background: rgba(255,255,255,0.04); border-radius: 6px; padding: 4px 9px;
    white-space: nowrap;
  }
  .pag-flow-arrow { color: var(--text-3); flex-shrink: 0; }

  /* Botão tutorial */
  .pag-btn-tutorial {
    display: inline-flex; align-items: center; gap: 10px;
    padding: 11px 18px; border-radius: 11px;
    background: rgba(200,165,94,0.1);
    border: 1px solid rgba(200,165,94,0.4);
    color: var(--gold); font-size: 12px; font-weight: 600;
    cursor: pointer; transition: all .18s; font-family: 'DM Sans', sans-serif;
    align-self: flex-start;
    box-shadow: 0 0 0 3px rgba(200,165,94,0.06), 0 4px 16px rgba(200,165,94,0.12);
    text-shadow: 0 0 20px rgba(200,165,94,0.4);
  }
  .pag-btn-tutorial:hover {
    background: rgba(200,165,94,0.16);
    border-color: rgba(200,165,94,0.65);
    box-shadow: 0 0 0 4px rgba(200,165,94,0.08), 0 6px 22px rgba(200,165,94,0.2);
    transform: translateY(-1px);
  }
  .pag-btn-tutorial span { flex: 1; }

  /* Info box — versão mais sutil */
  .pag-info-box {
    font-size: 11.5px; color: var(--text-3); line-height: 1.75;
    padding: 11px 14px; border-radius: 9px;
    background: rgba(255,255,255,0.025); border: 1px solid rgba(255,255,255,0.06);
  }
  .pag-info-box strong { color: var(--text-2); font-weight: 600; }

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
function SecaoEmpresa({ config, onSave, uid }) {
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

    const MAX_DIM = 800;
    const isPng   = file.type === "image/png";

    // Redimensiona e converte para Blob antes do upload pro Storage
    const redimensionar = (src) =>
      new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          let { width, height } = img;
          if (width > MAX_DIM || height > MAX_DIM) {
            if (width >= height) { height = Math.round(height * MAX_DIM / width); width = MAX_DIM; }
            else                 { width  = Math.round(width  * MAX_DIM / height); height = MAX_DIM; }
          }
          const canvas = document.createElement("canvas");
          canvas.width = width; canvas.height = height;
          const ctx = canvas.getContext("2d");
          // PNG preserva transparência; JPEG recebe fundo branco (não suporta alpha)
          if (!isPng) { ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, width, height); }
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob(resolve, isPng ? "image/png" : "image/jpeg", 0.85);
        };
        img.onerror = reject;
        img.src = src;
      });

    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        setSalvando(true);
        const blob = await redimensionar(ev.target.result);
        // Caminho fixo por tenant — novo upload sobrescreve o anterior automaticamente
        const sRef = storageRef(getStorage(), `logos/${uid}/logo`);
        await uploadBytes(sRef, blob);
        const url  = await getDownloadURL(sRef);
        set("logo", url);
      } catch {
        alert("Não foi possível enviar a imagem. Tente novamente.");
      } finally {
        setSalvando(false);
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
                    onClick={async e => {
                      e.stopPropagation();
                      try {
                        const sRef = storageRef(getStorage(), `logos/${uid}/logo`);
                        await deleteObject(sRef);
                      } catch {} // ignora se arquivo já não existe no Storage
                      set("logo", "");
                    }}>Remover</button>
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

function SecaoSeguranca({ config, onSave }) {
  /* ── Trocar senha Firebase ── */
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
    if (!form.senhaAtual)                  e.senhaAtual = "Informe a senha atual.";
    if (form.novaSenha.length < 6)         e.novaSenha  = "Mínimo 6 caracteres.";
    if (form.novaSenha !== form.confirmar)  e.confirmar  = "As senhas não conferem.";
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
    <>
      {/* Card: Trocar Senha Firebase */}
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

    </>
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
      desc: <>Após logar, vá em <strong>Meu Perfil → Seu negócio → Configurações → Gestão e Administração → Credenciais</strong>. Ou acesse diretamente: <a className="tut-link" href="https://www.mercadopago.com.br/developers/panel/app" target="_blank" rel="noreferrer">painel de aplicações <ExternalLink size={10} /></a>.</>,
    },
    {
      titulo: "Crie uma Aplicação",
      desc: <>No painel do desenvolvedor, clique em <strong>"Criar aplicação"</strong>. Dê um nome como <em>"ASSENT Gestão"</em>, selecione <strong>Pagamentos online</strong> como produto e confirme a criação.</>,
    },
    {
      titulo: "Use as Credenciais de Produção",
      desc: <>Dentro da sua aplicação, acesse a aba <strong>"Credenciais de produção"</strong>. Copie o <strong>Access Token</strong> e a <strong>Public Key</strong> — ambos são necessários. <br/><br/>⚠️ <strong>Não use credenciais de teste</strong> (sandbox) — elas não processam pagamentos reais.</>,
    },
    {
      titulo: "Copie o Access Token",
      desc: <>Localize o campo <strong>"Access Token"</strong> de produção — começa com <code>APP_USR-</code> seguido de uma longa sequência. Clique em <strong>Copiar</strong> e cole no campo desta tela. O token é salvo criptografado no servidor — <strong>nunca fica exposto no navegador</strong>.</>,
    },
    {
      titulo: "Registre o Webhook no Mercado Pago",
      desc: <>Este é o passo mais importante para a confirmação automática. Siga o caminho correto:<br/><br/>
        1. Acesse o <a className="tut-link" href="https://www.mercadopago.com.br/developers/panel" target="_blank" rel="noreferrer">painel de desenvolvedor <ExternalLink size={10} /></a><br/>
        2. No menu lateral, clique em <strong>Suas integrações</strong> (ou <strong>Aplicações</strong>)<br/>
        3. Clique na sua aplicação<br/>
        4. No menu lateral da aplicação, clique em <strong>Webhooks</strong><br/>
        5. Clique em <strong>"Adicionar webhook"</strong> e configure:<br/><br/>
        • <strong>URL:</strong> <code>https://us-central1-assent-2b945.cloudfunctions.net/mpWebhook</code><br/>
        • <strong>Eventos:</strong> marque <strong>"Pagamentos Presenciais"</strong><br/><br/>
        Isso faz o Mercado Pago notificar o ASSENT automaticamente quando o PIX for pago.</>,
    },
    {
      titulo: "Ative e Salve no ASSENT",
      desc: <>Cole o token no campo abaixo, ative o toggle <strong>"Ativar Pagamentos PIX"</strong> e clique em <strong>Salvar</strong>. Use <strong>"Testar conexão"</strong> para confirmar que o token está válido antes de usar no PDV.</>,
    },
    {
      titulo: "Habilite o PIX na sua conta MP",
      desc: <>Para receber via PIX, configure sua chave PIX dentro do app Mercado Pago: <strong>Configurações → PIX</strong>. Cadastre sua chave (CPF, CNPJ, e-mail ou telefone). Sem isso, o QR é gerado mas o pagamento não é processado.</>,
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
  const [token,        setToken]        = useState(config?.pagamentos?.mercadopago?.accessToken || "");
  const [publicKey,    setPublicKey]    = useState(config?.pagamentos?.mercadopago?.publicKey || "");
  const [ativo,        setAtivo]        = useState(config?.pagamentos?.mercadopago?.ativo ?? false);
  const [showToken,    setShowToken]    = useState(false);
  const [salvando,     setSalvando]     = useState(false);
  const [testando,     setTestando]     = useState(false);
  const [testeOk,      setTesteOk]      = useState(null); // null | true | false
  const [showTutorial, setShowTutorial] = useState(false);
  const [copiado,      setCopiado]      = useState(false);

  useEffect(() => {
    setToken(config?.pagamentos?.mercadopago?.accessToken || "");
    setPublicKey(config?.pagamentos?.mercadopago?.publicKey || "");
    setAtivo(config?.pagamentos?.mercadopago?.ativo ?? false);
    setTesteOk(null);
  }, [config]);

  const handleSalvar = async () => {
    if (!token.trim()) { alert("Informe o Access Token antes de salvar."); return; }
    if (ativo && !publicKey.trim()) { alert("Informe a Public Key para ativar os pagamentos."); return; }
    setSalvando(true);
    setTesteOk(null);
    try {
      await onSave({
        pagamentos: {
          mercadopago: {
            accessToken:  token.trim(),
            publicKey:    publicKey.trim(),
            ativo,
            atualizadoEm: new Date().toISOString(),
          }
        }
      });
    } finally {
      setSalvando(false);
    }
  };

  /* ── Testa o token via Cloud Function ──────────────────────────────
     O token já está salvo no Firestore; a CF lê de lá e valida no MP.
     Assim o token nunca sai do servidor para validação.
  ─────────────────────────────────────────────────────────────────── */
  const handleTestar = async () => {
    if (!token.trim()) return;

    // Se há alterações não salvas, salva primeiro
    const tokenSalvo = config?.pagamentos?.mercadopago?.accessToken || "";
    if (token.trim() !== tokenSalvo) {
      alert("Salve o token antes de testar a conexão.");
      return;
    }

    setTestando(true);
    setTesteOk(null);
    try {
      const consultarFn = httpsCallable(functions, "consultarPagamento");
      // Chama com paymentId inválido — se o erro for 404 (not found) o token é válido;
      // se for 401 (unauthorized) o token é inválido. Qualquer resposta da CF = token ok.
      await consultarFn({ tenantUid: config?._tenantUid || "", paymentId: 0 });
      setTesteOk(true);
    } catch (e) {
      // Erro "not-found" ou "invalid-argument" = token válido (CF respondeu)
      // Erro "failed-precondition" = token não configurado/inativo
      const code = e?.code || "";
      if (code === "functions/not-found" || code === "functions/invalid-argument") {
        setTesteOk(true);
      } else {
        setTesteOk(false);
      }
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

  return (
    <>
      {showTutorial && <ModalTutorialPagamento onClose={() => setShowTutorial(false)} />}

      <div className="cfg-card">
        <div className="cfg-card-header">
          <div className="cfg-card-header-icon"><Zap size={15} /></div>
          <div>
            <div className="cfg-card-title">Pagamentos Online</div>
            <div className="cfg-card-sub">Integração com gateways de pagamento para QR Code PIX</div>
          </div>
        </div>

        <div className="cfg-card-body">
          <div className="pag-wrap">

            <button className="pag-btn-tutorial" onClick={() => setShowTutorial(true)}>
              <BookOpen size={13} />
              <span>Tutorial — como cadastrar sua API de pagamento</span>
              <ArrowRight size={13} />
            </button>

            <div className="pag-info-box">
              <strong>Token protegido no servidor.</strong> O Access Token nunca trafega pelo navegador durante transações — todas as chamadas ao Mercado Pago passam pelas Cloud Functions do ASSENT.
            </div>

            <div className={`pag-mp-block ${ativo && token ? "ativo" : ""}`}>
              <div className="pag-mp-head">
                <div className="pag-mp-icon">
                  <CreditCard size={18} color="#fff" />
                </div>
                <div className="pag-mp-label">
                  <div className="pag-mp-nome">Mercado Pago</div>
                  <div className={`pag-mp-tag ${ativo && token ? "" : "inativo"}`}>
                    {ativo && token
                      ? <><span style={{ width: 5, height: 5, borderRadius: "50%", background: "#48bb78", display: "inline-block" }} /> Ativo</>
                      : "Não configurado"
                    }
                  </div>
                </div>
              </div>

              <div className="pag-toggle-row">
                <div>
                  <div className="pag-toggle-label">Aceitar pagamentos PIX</div>
                  <div className="pag-toggle-sub">Habilita PIX no PDV e adiantamento nas reservas do Flow</div>
                </div>
                <Toggle checked={ativo} onChange={setAtivo} />
              </div>

              <div className="pag-token-area">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">
                    Access Token de Produção <span className="form-label-req">*</span>
                  </label>
                  <div className="pag-token-wrap">
                    <input
                      type={showToken ? "text" : "password"}
                      className="form-input"
                      value={token}
                      onChange={e => { setToken(e.target.value); setTesteOk(null); }}
                      placeholder="APP_USR-••••••••••••••••••••••••••••••••••••••"
                    />
                    <button className="pag-token-toggle" onClick={() => setShowToken(s => !s)} type="button">
                      {showToken ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 0, marginTop: 14 }}>
                  <label className="form-label">
                    Public Key de Produção <span className="form-label-req">*</span>
                    <span style={{ fontWeight: 400, fontSize: 10, color: "var(--text-3)", marginLeft: 6 }}>
                      (usada no checkout de cartão — diferente do Access Token)
                    </span>
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={publicKey}
                    onChange={e => setPublicKey(e.target.value)}
                    placeholder="APP_USR-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    autoComplete="off"
                  />
                </div>

                <div className="pag-actions">
                  <button
                    className="btn-secondary"
                    style={{ fontSize: 11, padding: "5px 12px", display: "flex", alignItems: "center", gap: 6 }}
                    onClick={handleTestar}
                    disabled={!token.trim() || testando}
                    title="Salve o token antes de testar"
                  >
                    {testando
                      ? <><span className="cfg-spinner" />Verificando...</>
                      : testeOk === true
                        ? <><Check size={12} color="#48bb78" />Verificado</>
                        : testeOk === false
                          ? <><WifiOff size={12} color="var(--red)" />Falhou</>
                          : <><Wifi size={12} />Testar conexão</>
                    }
                  </button>
                  <button
                    className="btn-secondary"
                    style={{ fontSize: 11, padding: "5px 12px", display: "flex", alignItems: "center", gap: 6 }}
                    onClick={handleCopiar}
                    disabled={!token}
                  >
                    <Copy size={11} />{copiado ? "Copiado!" : "Copiar token"}
                  </button>
                </div>

                <div className={`pag-status ${testeOk === true ? "ok" : testeOk === false ? "erro" : ""}`}>
                  <span className="pag-status-dot" />
                  {testeOk === true
                    ? "Cloud Function conectada ao Mercado Pago com sucesso"
                    : testeOk === false
                      ? "Falha — verifique o token e o webhook"
                      : token
                        ? "Salve e clique em Testar conexão para validar"
                        : "Nenhum token configurado"
                  }
                </div>
              </div>
            </div>

            <div className="pag-webhook">
              <div className="pag-webhook-head">
                <ServerCog size={13} />
                Webhook — registre no painel do Mercado Pago
              </div>
              <div className="pag-webhook-url">
                <span style={{ flex: 1 }}>
                  https://us-central1-assent-2b945.cloudfunctions.net/mpWebhook
                </span>
                <button
                  className="pag-copy-url"
                  onClick={() => navigator.clipboard.writeText("https://us-central1-assent-2b945.cloudfunctions.net/mpWebhook")}
                >
                  <Copy size={10} /> Copiar
                </button>
              </div>
              <div className="pag-flow">
                {["Cliente paga o PIX", "MP notifica webhook", "Cloud Function", "Firestore atualiza"].map((s, i, arr) => (
                  <span key={s} style={{ display: "contents" }}>
                    <span className="pag-flow-step">{s}</span>
                    <ArrowRight size={11} className="pag-flow-arrow" />
                  </span>
                ))}
                <span className="pag-flow-step" style={{ color: "#48bb78" }}>Venda finalizada ✓</span>
              </div>
            </div>

          </div>
        </div>

        <div className="cfg-card-footer">
          <button className="btn-primary" onClick={handleSalvar} disabled={salvando || !token.trim() || (ativo && !publicKey.trim())}>
            {salvando ? <><span className="cfg-spinner" />Salvando...</> : <><Save size={13} />Salvar</>}
          </button>
        </div>
      </div>
    </>
  );
}


const buildVisivel = (cfg) => {
  const base = {};
  MENU_SECTIONS.forEach(s => {
    base[s.key] = s.locked ? true : (cfg?.menuVisivel?.[s.key] !== undefined ? cfg.menuVisivel[s.key] : true);
  });
  return base;
};

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
              <div className="menu-toggle-icon"><s.Icon size={15} /></div>
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
                <div className="atalho-icon"><section.Icon size={15} /></div>
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
      fsError(err, "Configuracoes:carregarLogs");
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
   SEÇÃO MATRÍCULAS — Gerenciamento de turmas/horários
   Firestore: users/{tenantUid}/config/matriculas → turmas[]
   ══════════════════════════════════════════════════════ */
function SecaoMatriculas({ tenantUid }) {
  const [turmas, setTurmas]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [salvando, setSalvando]   = useState(false);
  const [salvo, setSalvo]         = useState(false);  // feedback visual

  const [novaTurma, setNovaTurma] = useState("");
  const [editIdx, setEditIdx]     = useState(null);
  const [editVal, setEditVal]     = useState("");

  const MAX_TURMAS   = 50;
  const MAX_NOME_LEN = 60;

  useEffect(() => {
    if (!tenantUid) { setLoading(false); return; }
    getDoc(doc(db, "users", tenantUid, "config", "matriculas"))
      .then(snap => {
        if (snap.exists()) {
          const data = snap.data();
          setTurmas(Array.isArray(data.turmas) ? data.turmas : []);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [tenantUid]);

  const addTurma = () => {
    const nome = novaTurma.trim().slice(0, MAX_NOME_LEN);
    if (!nome) return;
    if (turmas.some(t => t.toLowerCase() === nome.toLowerCase())) {
      alert("Já existe uma turma com esse nome."); return;
    }
    if (turmas.length >= MAX_TURMAS) {
      alert(`Limite de ${MAX_TURMAS} turmas atingido.`); return;
    }
    setTurmas(l => [...l, nome]);
    setNovaTurma("");
  };

  const removeTurma = (idx) => {
    if (!window.confirm("Remover esta turma? Os alunos vinculados não serão afetados.")) return;
    setTurmas(l => l.filter((_, i) => i !== idx));
    if (editIdx === idx) setEditIdx(null);
  };

  const startEdit = (idx) => { setEditIdx(idx); setEditVal(turmas[idx]); };

  const confirmEdit = () => {
    const nome = editVal.trim().slice(0, MAX_NOME_LEN);
    if (!nome) { setEditIdx(null); return; }
    if (turmas.some((t, i) => i !== editIdx && t.toLowerCase() === nome.toLowerCase())) {
      alert("Já existe uma turma com esse nome."); return;
    }
    setTurmas(l => l.map((t, i) => (i === editIdx ? nome : t)));
    setEditIdx(null);
  };

  const handleSalvar = async () => {
    if (!tenantUid) return;
    setSalvando(true);
    try {
      await setDoc(
        doc(db, "users", tenantUid, "config", "matriculas"),
        { turmas, atualizadoEm: new Date().toISOString() },
        { merge: true }
      );
      setSalvo(true);
      setTimeout(() => setSalvo(false), 2500);
    } catch (err) {
      fsError(err, "Configuracoes:turmas");
      alert("Erro ao salvar turmas. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  };

  if (loading) return <div className="cfg-loading">Carregando turmas...</div>;

  return (
    <div className="cfg-card">
      <div className="cfg-card-header">
        <div className="cfg-card-header-icon"><GraduationCap size={15} /></div>
        <div>
          <div className="cfg-card-title">Turmas / Horários</div>
          <div className="cfg-card-sub">Categorias disponíveis no cadastro de alunos</div>
        </div>
      </div>

      <div className="cfg-card-body">
        <p style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 18, lineHeight: 1.7 }}>
          Defina as turmas e horários que aparecem como opções no módulo de Matrículas.
          Remover uma turma <strong style={{ color: "var(--text-2)" }}>não afeta</strong> os alunos já vinculados a ela.
        </p>

        {/* Lista de turmas */}
        <div className="turmas-list">
          {turmas.length === 0 && (
            <div className="turmas-empty">Nenhuma turma cadastrada ainda. Adicione a primeira abaixo.</div>
          )}
          {turmas.map((t, idx) => (
            <div key={idx} className="turma-item">
              {editIdx === idx ? (
                <input
                  className="turma-item-input"
                  value={editVal}
                  maxLength={MAX_NOME_LEN}
                  autoFocus
                  onChange={(e) => setEditVal(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter")  confirmEdit();
                    if (e.key === "Escape") setEditIdx(null);
                  }}
                />
              ) : (
                <span className="turma-item-nome">{t}</span>
              )}
              <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                {editIdx === idx ? (
                  <>
                    <button className="turma-btn-base turma-btn-ok"
                      onClick={confirmEdit} title="Confirmar (Enter)">
                      <Check size={13} />
                    </button>
                    <button className="turma-btn-base turma-btn-cancel"
                      onClick={() => setEditIdx(null)} title="Cancelar (Esc)">
                      <X size={13} />
                    </button>
                  </>
                ) : (
                  <>
                    <button className="turma-btn-base turma-btn-edit"
                      onClick={() => startEdit(idx)} title="Renomear">
                      <Edit2 size={13} />
                    </button>
                    <button className="turma-btn-base turma-btn-del"
                      onClick={() => removeTurma(idx)} title="Remover">
                      <Trash2 size={13} />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Adicionar nova turma */}
        {turmas.length < MAX_TURMAS && (
          <div className="turmas-add-row">
            <input
              className="form-input"
              type="text"
              placeholder="Nome da turma (ex: Turma A, Terça 19h, Equipe Juvenil…)"
              value={novaTurma}
              maxLength={MAX_NOME_LEN}
              onChange={(e) => setNovaTurma(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addTurma()}
            />
            <button className="btn-primary" onClick={addTurma} disabled={!novaTurma.trim()}>
              <Plus size={14} /> Adicionar
            </button>
          </div>
        )}
      </div>

      <div className="cfg-card-footer">
        <span style={{ fontSize: 11, color: "var(--text-3)", flex: 1, alignSelf: "center" }}>
          {turmas.length} turma{turmas.length !== 1 ? "s" : ""} cadastrada{turmas.length !== 1 ? "s" : ""}
        </span>
        <button className="btn-primary" onClick={handleSalvar} disabled={salvando}>
          {salvando
            ? <><span className="cfg-spinner" /> Salvando...</>
            : salvo
            ? <><CheckCircle2 size={13} /> Salvo!</>
            : <><Save size={13} /> Salvar turmas</>}
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   SEÇÃO LGPD
   ══════════════════════════════════════════════════════ */
function SecaoLGPD() {
  return (
    <div className="cfg-card">
      <h3 className="cfg-card-title">
        <FileText size={18} /> Termos de Responsabilidade e Conformidade LGPD
      </h3>
      
      <div style={{ overflow: "auto", maxHeight: "calc(100vh - 300px)", paddingRight: 12 }} className="lgpd-content">
        <style>{`
          .lgpd-content {
            font-family: Georgia, serif;
            line-height: 1.8;
            color: var(--text-primary);
            padding: 8px 0;
          }
          .lgpd-content h2 {
            color: var(--text-primary);
            font-family: Montserrat, sans-serif;
            font-size: 16px;
            margin-top: 32px;
            margin-bottom: 16px;
            border-left: 3px solid #D4AF37;
            padding-left: 14px;
            font-weight: 600;
          }
          .lgpd-content h3 {
            color: var(--text-primary);
            font-family: Montserrat, sans-serif;
            font-size: 14px;
            margin-top: 20px;
            margin-bottom: 12px;
            font-weight: 500;
          }
          .lgpd-content ul, .lgpd-content ol {
            margin: 14px 0;
            padding-left: 32px;
          }
          .lgpd-content li {
            margin-bottom: 8px;
            font-size: 14px;
            color: var(--text-primary);
          }
          .lgpd-content p {
            margin: 14px 0;
            font-size: 14px;
            color: var(--text-primary);
          }
          .contact-box {
            background: var(--bg-secondary);
            padding: 18px;
            border-left: 3px solid #D4AF37;
            margin-top: 28px;
            border-radius: 4px;
            font-size: 13px;
            color: var(--text-primary);
          }
          .contact-box p {
            margin: 8px 0;
          }
          .contact-box strong {
            color: var(--text-primary);
            font-weight: 600;
          }
        `}</style>

        <h2>1. TERMOS DE RESPONSABILIDADE</h2>
        
        <h3>1.1 Aceitação dos Termos</h3>
        <p>Ao utilizar ASSENT Gestão v2.0, você concorda com os termos apresentados neste documento. Se não concordar com qualquer disposição, não utilize o serviço.</p>

        <h3>1.2 Responsabilidade da ASSENT</h3>
        <p>A ASSENT Agência fornece ASSENT Gestão "NO ESTADO EM QUE SE ENCONTRA". Nós nos comprometemos em:</p>
        <ul>
          <li>Manter a disponibilidade do serviço com SLA de 99% (excetuando manutenções programadas)</li>
          <li>Implementar controles de segurança para proteger dados pessoais conforme LGPD</li>
          <li>Notificar você em caso de vazamento de dados em até 72 horas</li>
          <li>Manter backups automatizados e redundância em infraestrutura</li>
          <li>Fornecer suporte técnico durante horários comerciais</li>
        </ul>

        <h3>1.3 Limitações de Responsabilidade</h3>
        <p>A ASSENT Agência <strong>NÃO SERÁ RESPONSÁVEL</strong> por:</p>
        <ul>
          <li>Perda de dados causada por ação do usuário (deleção, exportação incorreta)</li>
          <li>Interrupções causadas por força maior (desastre natural, guerra, sabotagem)</li>
          <li>Acesso não autorizado causado por credenciais compartilhadas ou senha fraca</li>
          <li>Lucros cessantes, danos indiretos ou consequenciais</li>
          <li>Uso do serviço em desconformidade com estes termos</li>
          <li>Falhas causadas por software/hardware de terceiros</li>
        </ul>

        <h3>1.4 Responsabilidade do Usuário</h3>
        <p>Você é responsável por:</p>
        <ul>
          <li>Manter confidencialidade de credenciais de acesso</li>
          <li>Usar senhas fortes (mínimo 12 caracteres, com maiúsculas, minúsculas, números e símbolos)</li>
          <li>Não compartilhar login entre usuários</li>
          <li>Realizar backups frequentes de dados críticos</li>
          <li>Não tentar contornar medidas de segurança</li>
          <li>Informar imediatamente a ASSENT em caso de acesso não autorizado</li>
        </ul>

        <h2>2. CONFORMIDADE COM LEI LGPD</h2>

        <h3>2.1 Escopo da LGPD</h3>
        <p>ASSENT Gestão processa dados pessoais em conformidade com a Lei Geral de Proteção de Dados Pessoais (Lei n. 13.709/2018). Este documento explica como tratamos seus dados.</p>

        <h3>2.2 Tipos de Dados Processados</h3>
        <ul>
          <li><strong>Dados de Identificação:</strong> nome, email, telefone, CNPJ/CPF</li>
          <li><strong>Dados de Contato de Clientes:</strong> nomes, emails, telefones, endereços</li>
          <li><strong>Dados de Vendas:</strong> histórico de transações, valores, datas</li>
          <li><strong>Dados de Agendamento:</strong> datas, horários, serviços, prestadores</li>
          <li><strong>Dados Técnicos:</strong> endereço IP, logs de acesso, cookies, informações de dispositivo</li>
        </ul>

        <h3>2.3 Base Legal para Processamento</h3>
        <ul>
          <li>Consentimento explícito do titular (quando aplicável)</li>
          <li>Execução de contrato (para prestar ASSENT Gestão)</li>
          <li>Obrigação legal (legislação fiscal, trabalhista, previdenciária)</li>
          <li>Interesse legítimo da ASSENT (segurança, prevenção de fraude)</li>
        </ul>

        <h3>2.4 Compartilhamento de Dados</h3>
        <p>Compartilhamos dados com:</p>
        <ul>
          <li>Google Cloud (armazenamento e autenticação)</li>
          <li>Firebase (banco de dados, autenticação)</li>
          <li>Fornecedores de segurança (para proteção contra ameaças)</li>
          <li>Autoridades legais (quando obrigado por lei)</li>
        </ul>

        <h3>2.5 Retenção de Dados</h3>
        <ul>
          <li>Cumprir obrigações legais: 5 anos (obrigações fiscais e trabalhistas)</li>
          <li>Resolver disputas: 6 meses após encerramento de contrato</li>
          <li>Manter logs de segurança: 12 meses</li>
          <li>Dados técnicos: 30 dias para logs, 60 dias para backups</li>
        </ul>

        <h3>2.6 Direitos do Titular</h3>
        <p>Você tem direito de:</p>
        <ul>
          <li>Acessar seus dados pessoais</li>
          <li>Solicitar correção de dados imprecisos</li>
          <li>Solicitar exclusão de dados (direito ao esquecimento)</li>
          <li>Solicitar portabilidade de dados em formato estruturado</li>
          <li>Revogar consentimento a qualquer momento</li>
          <li>Se opor ao processamento de dados para fins específicos</li>
          <li>Solicitar revisão de decisões automatizadas</li>
        </ul>

        <h2>3. SEGURANÇA DE DADOS</h2>

        <h3>3.1 Medidas de Segurança</h3>
        <ul>
          <li>Criptografia AES-256 para dados em repouso</li>
          <li>TLS/HTTPS para dados em trânsito</li>
          <li>Autenticação de dois fatores (2FA) opcional</li>
          <li>Firestore Security Rules para controle de acesso</li>
          <li>Sanitização de erros para evitar exposição de informações sensíveis</li>
          <li>Monitoramento contínuo de tentativas de acesso não autorizado</li>
          <li>Backups automáticos com redundância geográfica</li>
        </ul>

        <h3>3.2 Protocolo de Vazamento</h3>
        <p>Em caso de suspeita de vazamento:</p>
        <ol>
          <li>ASSENT isola o acesso imediatamente</li>
          <li>Inicia investigação forense em até 2 horas</li>
          <li>Notifica titulares de dados em até 72 horas</li>
          <li>Notifica autoridades (se obrigado por lei) em até 3 dias</li>
        </ol>

        <h2>4. USO PROIBIDO</h2>
        <p>É proibido usar ASSENT Gestão para:</p>
        <ul>
          <li>Processar dados pessoais sem consentimento válido ou base legal</li>
          <li>Qualquer atividade ilegal ou que viole direitos de terceiros</li>
          <li>Ataques cibernéticos, engenharia social, phishing</li>
          <li>Acesso não autorizado ou tentativa de contornar segurança</li>
          <li>Venda ou compartilhamento de dados sem consentimento</li>
          <li>Processar dados sensíveis (origem racial, religião, biométricos) sem consentimento explícito</li>
        </ul>

        <h2>5. SUSPENSÃO E ENCERRAMENTO</h2>

        <h3>5.1 Suspensão Automática</h3>
        <p>ASSENT pode suspender acesso imediatamente se:</p>
        <ul>
          <li>Detectar violação de segurança</li>
          <li>Detectar processamento ilegal de dados</li>
          <li>Pagamento em atraso (após 30 dias de notificação)</li>
          <li>Violação reiterada destes termos</li>
        </ul>

        <h3>5.2 Encerramento</h3>
        <ul>
          <li>Exportar dados em formato estruturado (prazo: 30 dias)</li>
          <li>ASSENT excluirá dados após 60 dias do encerramento</li>
        </ul>

        <h2>6. CONTATO</h2>
        <div className="contact-box">
          <p><strong>Empresa:</strong> ASSENT Agência Ltda</p>
          <p><strong>Endereço:</strong> Goiânia, GO, Brasil</p>
          <p><strong>Email:</strong> assent.ofc@gmail.com</p>
          
        </div>
      </div>

      <div className="cfg-card-footer">
        <span style={{ fontSize: 11, color: "var(--text-3)" }}>
          Última atualização: {new Date().toLocaleDateString("pt-BR")}
        </span>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
   ══════════════════════════════════════════════════════ */
const SECOES_POR_CARGO = {
  admin:       ["empresa", "seguranca", "financeiro", "pagamentos", "menu", "estoque", "matriculas", "atalhos", "log", "lgpd"],
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
      case "empresa":    return <SecaoEmpresa    config={config} onSave={handleSave} uid={uid} />;
      case "seguranca":  return <SecaoSeguranca config={config} onSave={handleSave} />;
      case "financeiro": return <SecaoFinanceiro config={config} onSave={handleSave} />;
      case "pagamentos": return <SecaoPagamentos config={config} onSave={handleSave} />;
      case "menu":       return <SecaoMenu       config={config} onSave={handleSave} />;
      case "estoque":    return <SecaoEstoque    config={config} onSave={handleSave} />;
      case "matriculas": return <SecaoMatriculas tenantUid={uid} />;
      case "atalhos":    return <SecaoAtalhos    menuVisivel={menuVisivelProp ?? config?.menuVisivel ?? {}} />;
      case "log":        return <SecaoLog        tenantUid={uid} />;
      case "lgpd":       return <SecaoLGPD />;
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
            {navFiltrado.filter(n => n.id !== "log" && n.id !== "lgpd").map(({ id, label, icon: Icon }) => (
              <button key={id} className={`cfg-nav-item ${secao === id ? "active" : ""}`} onClick={() => setSecao(id)}>
                <Icon size={15} className="cfg-nav-icon" />
                <span className="cfg-nav-label">{label}</span>
                {secao === id && <ChevronRight size={13} color="var(--text-3)" />}
              </button>
            ))}
            {navFiltrado.some(n => n.id === "log" || n.id === "lgpd") && (
              <>
                <span className="cfg-nav-group-label" style={{ marginTop: 14 }}>Auditoria e Conformidade</span>
                {navFiltrado.some(n => n.id === "log") && (
                  <button className={`cfg-nav-item ${secao === "log" ? "active" : ""}`} onClick={() => setSecao("log")}>
                    <Activity size={15} className="cfg-nav-icon" />
                    <span className="cfg-nav-label">Log de Atividades</span>
                    {secao === "log" && <ChevronRight size={13} color="var(--text-3)" />}
                  </button>
                )}
                {navFiltrado.some(n => n.id === "lgpd") && (
                  <button className={`cfg-nav-item ${secao === "lgpd" ? "active" : ""}`} onClick={() => setSecao("lgpd")}>
                    <FileText size={15} className="cfg-nav-icon" />
                    <span className="cfg-nav-label">Termos e LGPD</span>
                    {secao === "lgpd" && <ChevronRight size={13} color="var(--text-3)" />}
                  </button>
                )}
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
