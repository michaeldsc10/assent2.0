// AuthContext.jsx — ASSENT v2.0
// Expõe: { user, cargo, tenantUid, vendedorId, vendedorNome, nomeUsuario, loadingAuth, signIn, signOut, permissoes }
// Integrado com Firebase Auth + Firestore (estrutura multi-tenant)
// Rate Limiting adicionado no signIn para proteção contra brute force

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../lib/firebase"; // ajuste o caminho conforme seu projeto

// ─────────────────────────────────────────────
// Constantes de cargo
// ─────────────────────────────────────────────
export const CARGOS = {
  ADMIN:       "admin",
  FINANCEIRO:  "financeiro",
  COMERCIAL:   "comercial",
  COMPRAS:     "compras",
  OPERACIONAL: "operacional",
  VENDEDOR:    "vendedor",
  SUPORTE:     "suporte",
};

// ─────────────────────────────────────────────
// Chaves de permissão granulares (novo sistema)
// ─────────────────────────────────────────────
export const PERM = {
  verDashboard:         "verDashboard",
  verClientes:          "verClientes",          gerenciarClientes:      "gerenciarClientes",
  verProdutos:          "verProdutos",           gerenciarProdutos:      "gerenciarProdutos",
  verServicos:          "verServicos",           gerenciarServicos:      "gerenciarServicos",
  verVendas:            "verVendas",             gerenciarVendas:        "gerenciarVendas",
  verPDV:               "verPDV",                gerenciarPDV:           "gerenciarPDV",
  verAgenda:            "verAgenda",             gerenciarAgenda:        "gerenciarAgenda",
  verEstoque:           "verEstoque",            gerenciarEstoque:       "gerenciarEstoque",
  verCompras:           "verCompras",            gerenciarCompras:       "gerenciarCompras",
  verOrcamentos:        "verOrcamentos",         gerenciarOrcamentos:    "gerenciarOrcamentos",
  verFornecedores:      "verFornecedores",       gerenciarFornecedores:  "gerenciarFornecedores",
  verAReceber:          "verAReceber",           gerenciarAReceber:      "gerenciarAReceber",
  verCaixaDiario:       "verCaixaDiario",        gerenciarCaixaDiario:   "gerenciarCaixaDiario",
  verDespesas:          "verDespesas",           gerenciarDespesas:      "gerenciarDespesas",
  verMesas:             "verMesas",              gerenciarMesas:         "gerenciarMesas",
  verMatriculas:        "verMatriculas",         gerenciarMatriculas:    "gerenciarMatriculas",
  verVendedores:        "verVendedores",
  verRelatorios:        "verRelatorios",
  verRelFinanceiro:     "verRelFinanceiro",
  verRelDespesas:       "verRelDespesas",
  verRelCompras:        "verRelCompras",
  verRelEstoque:        "verRelEstoque",
  verRelVendas:         "verRelVendas",
  verRelClientes:       "verRelClientes",
  verRelAgenda:         "verRelAgenda",
  verRelPDV:            "verRelPDV",
  verAgendamento:       "verAgendamento",        gerenciarAgendamento:   "gerenciarAgendamento",
  verCRM:               "verCRM",
};

// Labels para exibição na UI de gestão de cargos
export const PERM_LABELS = {
  verDashboard:        "Ver Dashboard",
  verClientes:         "Ver Clientes",          gerenciarClientes:     "Gerenciar Clientes",
  verProdutos:         "Ver Produtos",           gerenciarProdutos:     "Gerenciar Produtos",
  verServicos:         "Ver Serviços",           gerenciarServicos:     "Gerenciar Serviços",
  verVendas:           "Ver Vendas",             gerenciarVendas:       "Gerenciar Vendas",
  verPDV:              "Ver PDV",                gerenciarPDV:          "Usar PDV",
  verAgenda:           "Ver Agenda",             gerenciarAgenda:       "Gerenciar Agenda",
  verEstoque:          "Ver Estoque",            gerenciarEstoque:      "Gerenciar Estoque",
  verCompras:          "Ver Compras",            gerenciarCompras:      "Gerenciar Compras",
  verOrcamentos:       "Ver Orçamentos",         gerenciarOrcamentos:   "Gerenciar Orçamentos",
  verFornecedores:     "Ver Fornecedores",       gerenciarFornecedores: "Gerenciar Fornecedores",
  verAReceber:         "Ver A Receber",          gerenciarAReceber:     "Gerenciar A Receber",
  verCaixaDiario:      "Ver Caixa Diário",       gerenciarCaixaDiario:  "Gerenciar Caixa Diário",
  verDespesas:         "Ver Despesas",           gerenciarDespesas:     "Gerenciar Despesas",
  verMesas:            "Ver Mesas",              gerenciarMesas:        "Gerenciar Mesas",
  verMatriculas:       "Ver Matrículas",         gerenciarMatriculas:   "Gerenciar Matrículas",
  verVendedores:       "Ver Vendedores",
  verRelatorios:       "Ver Relatórios",
  verRelFinanceiro:    "Rel. Financeiro/DRE",
  verRelDespesas:      "Rel. Despesas",
  verRelCompras:       "Rel. Compras",
  verRelEstoque:       "Rel. Estoque",
  verRelVendas:        "Rel. Vendas",
  verRelClientes:      "Rel. Clientes",
  verRelAgenda:        "Rel. Agenda",
  verRelPDV:           "Rel. PDV",
  verAgendamento:      "Ver Agendamento",        gerenciarAgendamento:  "Gerenciar Agendamento",
  verCRM:              "Ver CRM",
};

// Grupos para exibição organizada na UI
export const PERM_GRUPOS = [
  { label: "Geral",        chaves: ["verDashboard"] },
  { label: "Clientes",     chaves: ["verClientes","gerenciarClientes"] },
  { label: "Produtos",     chaves: ["verProdutos","gerenciarProdutos"] },
  { label: "Serviços",     chaves: ["verServicos","gerenciarServicos"] },
  { label: "Vendas",       chaves: ["verVendas","gerenciarVendas","verPDV","gerenciarPDV"] },
  { label: "Orçamentos",   chaves: ["verOrcamentos","gerenciarOrcamentos"] },
  { label: "Agenda",       chaves: ["verAgenda","gerenciarAgenda"] },
  { label: "Estoque",      chaves: ["verEstoque","gerenciarEstoque"] },
  { label: "Financeiro",   chaves: ["verAReceber","gerenciarAReceber","verCaixaDiario","gerenciarCaixaDiario","verDespesas","gerenciarDespesas"] },
  { label: "Compras",      chaves: ["verCompras","gerenciarCompras","verFornecedores","gerenciarFornecedores"] },
  { label: "Mesas",        chaves: ["verMesas","gerenciarMesas"] },
  { label: "Matrículas",   chaves: ["verMatriculas","gerenciarMatriculas"] },
  { label: "Vendedores",   chaves: ["verVendedores"] },
  { label: "Relatórios",   chaves: ["verRelatorios","verRelFinanceiro","verRelDespesas","verRelCompras","verRelEstoque","verRelVendas","verRelClientes","verRelAgenda","verRelPDV"] },
  { label: "Agendamento",  chaves: ["verAgendamento","gerenciarAgendamento"] },
  { label: "CRM",          chaves: ["verCRM"] },
];

// ─────────────────────────────────────────────
// Permissões padrão por cargo (seed inicial)
// ─────────────────────────────────────────────
export const PERMISSOES_PADRAO_CARGO = {
  vendedor: {
    verClientes:true, gerenciarClientes:true,
    verProdutos:true, verServicos:true,
    verVendas:true, gerenciarVendas:true,
    verPDV:true, gerenciarPDV:true,
    verOrcamentos:true, gerenciarOrcamentos:true,
    verAgenda:true,
    verMesas:true, gerenciarMesas:false,
    verMatriculas:true,
    verRelatorios:true, verRelVendas:true, verRelClientes:true, verRelAgenda:true, verRelPDV:true,
  },
  financeiro: {
    verDashboard:true,
    verClientes:true, verProdutos:true, verServicos:true,
    verVendas:true, verPDV:true,
    verAReceber:true, gerenciarAReceber:true,
    verCaixaDiario:true, gerenciarCaixaDiario:true,
    verDespesas:true, gerenciarDespesas:true,
    verCompras:true, verEstoque:true,
    verAgenda:true,
    verRelatorios:true, verRelFinanceiro:true, verRelDespesas:true,
    verRelCompras:true, verRelEstoque:true, verRelVendas:true,
    verAgendamento:true,
  },
  comercial: {
    verClientes:true, gerenciarClientes:true,
    verProdutos:true, verServicos:true, gerenciarServicos:true,
    verVendas:true, gerenciarVendas:true,
    verPDV:true, gerenciarPDV:true,
    verOrcamentos:true, gerenciarOrcamentos:true,
    verAgenda:true, gerenciarAgenda:true,
    verMesas:true, gerenciarMesas:true,
    verMatriculas:true, gerenciarMatriculas:true,
    verVendedores:true,
    verRelatorios:true, verRelVendas:true, verRelClientes:true, verRelAgenda:true, verRelPDV:true, verRelEstoque:true,
    verAgendamento:true, gerenciarAgendamento:true,
  },
  operacional: {
    verClientes:true, gerenciarClientes:true,
    verProdutos:true, gerenciarProdutos:true,
    verServicos:true, gerenciarServicos:true,
    verEstoque:true, gerenciarEstoque:true,
    verCaixaDiario:true,
    verAgenda:true, gerenciarAgenda:true,
    verMesas:true, gerenciarMesas:true,
    verMatriculas:true,
    verRelatorios:true, verRelEstoque:true,
    verAgendamento:true, gerenciarAgendamento:true,
  },
  suporte: {
    verClientes:true, verProdutos:true, verServicos:true,
    verOrcamentos:true, verPDV:true,
    verRelatorios:true, verRelVendas:true, verRelClientes:true, verRelPDV:true,
  },
};

// ─────────────────────────────────────────────
// Matriz legada — mantida para compatibilidade
// ─────────────────────────────────────────────
export const PERMISSOES = {
  dashboard:      { admin: "v",    financeiro: "v",   comercial: "",    compras: "",    operacional: "",    vendedor: "",    suporte: ""   },
  agenda:         { admin: "vcex", financeiro: "v",   comercial: "vcex",compras: "vc",  operacional: "vce", vendedor: "vc",  suporte: "vc" },
  clientes:       { admin: "vcex", financeiro: "v",   comercial: "vce", compras: "",    operacional: "vce", vendedor: "vce", suporte: "ve" },
  produtos:       { admin: "vcex", financeiro: "v",   comercial: "v",   compras: "vce", operacional: "vce", vendedor: "v",   suporte: "v"  },
  servicos:       { admin: "vcex", financeiro: "v",   comercial: "vce", compras: "",    operacional: "vce", vendedor: "v",   suporte: "v"  },
  fornecedores:   { admin: "vcex", financeiro: "v",   comercial: "",    compras: "vce", operacional: "v",   vendedor: "",    suporte: ""   },
  vendedores:     { admin: "vcex", financeiro: "",    comercial: "v",   compras: "",    operacional: "",    vendedor: "",    suporte: ""   },
  entradaEstoque: { admin: "vcex", financeiro: "v",   comercial: "",    compras: "vce", operacional: "vce", vendedor: "",    suporte: ""   },
  compras:        { admin: "vcex", financeiro: "ve",  comercial: "",    compras: "vce", operacional: "v",   vendedor: "",    suporte: ""   },
  orcamentos:     { admin: "vcex", financeiro: "v",   comercial: "vce", compras: "",    operacional: "v",   vendedor: "vce", suporte: "v"  },
  vendas:         { admin: "vcex", financeiro: "v",   comercial: "vce", compras: "",    operacional: "v",   vendedor: "vc",  suporte: ""   },
  pdv:            { admin: "vcex", financeiro: "v",   comercial: "vc",  compras: "",    operacional: "",    vendedor: "vc",  suporte: "v"  },
  alunos:         { admin: "vcex", financeiro: "v",   comercial: "vce", compras: "",    operacional: "v",   vendedor: "v",   suporte: ""   },
  aReceber:       { admin: "vcex", financeiro: "vce", comercial: "v",   compras: "",    operacional: "",    vendedor: "",    suporte: ""   },
  caixaDiario:    { admin: "vcex", financeiro: "vce", comercial: "",    compras: "",    operacional: "vc",  vendedor: "",    suporte: ""   },
  despesas:       { admin: "vcex", financeiro: "vce", comercial: "",    compras: "vc",  operacional: "",    vendedor: "",    suporte: ""   },
  relatorios:     { admin: "v",    financeiro: "v",   comercial: "v",   compras: "v",   operacional: "v",   vendedor: "v",   suporte: "v"  },
  mesas:          { admin: "vcex", financeiro: "v",   comercial: "vce", compras: "",    operacional: "vce", vendedor: "vc",  suporte: ""   },
  usuarios:       { admin: "vcex", financeiro: "",    comercial: "",    compras: "",    operacional: "",    vendedor: "",    suporte: ""   },
  configuracoes:  { admin: "vcex", financeiro: "",    comercial: "",    compras: "",    operacional: "",    vendedor: "",    suporte: ""   },
  agendamento:    { admin: "vcex", financeiro: "v",   comercial: "vce", compras: "",    operacional: "vcex",vendedor: "vc",  suporte: "v"  },
};

export const PERMISSOES_RELATORIOS = {
  dre:        { admin: true, financeiro: true,  comercial: false, compras: false, operacional: false, vendedor: false, suporte: false },
  financeiro: { admin: true, financeiro: true,  comercial: false, compras: false, operacional: false, vendedor: false, suporte: false },
  despesas:   { admin: true, financeiro: true,  comercial: false, compras: false, operacional: false, vendedor: false, suporte: false },
  compras:    { admin: true, financeiro: true,  comercial: false, compras: true,  operacional: false, vendedor: false, suporte: false },
  estoque:    { admin: true, financeiro: true,  comercial: true,  compras: true,  operacional: true,  vendedor: true,  suporte: false },
  vendas:     { admin: true, financeiro: true,  comercial: true,  compras: false, operacional: false, vendedor: true,  suporte: true  },
  clientes:   { admin: true, financeiro: false, comercial: true,  compras: false, operacional: false, vendedor: true,  suporte: true  },
  agenda:     { admin: true, financeiro: false, comercial: true,  compras: false, operacional: false, vendedor: true,  suporte: true  },
  pdv:        { admin: true, financeiro: true,  comercial: true,  compras: false, operacional: false, vendedor: true,  suporte: true  },
};

// ─────────────────────────────────────────────
// Mapeamento módulo → permissão granular
// ─────────────────────────────────────────────
const MODULO_PERM = {
  dashboard:      { ver: "verDashboard",    ger: null },
  clientes:       { ver: "verClientes",     ger: "gerenciarClientes" },
  produtos:       { ver: "verProdutos",     ger: "gerenciarProdutos" },
  servicos:       { ver: "verServicos",     ger: "gerenciarServicos" },
  vendas:         { ver: "verVendas",       ger: "gerenciarVendas" },
  pdv:            { ver: "verPDV",          ger: "gerenciarPDV" },
  agenda:         { ver: "verAgenda",       ger: "gerenciarAgenda" },
  entradaEstoque: { ver: "verEstoque",      ger: "gerenciarEstoque" },
  compras:        { ver: "verCompras",      ger: "gerenciarCompras" },
  orcamentos:     { ver: "verOrcamentos",   ger: "gerenciarOrcamentos" },
  fornecedores:   { ver: "verFornecedores", ger: "gerenciarFornecedores" },
  aReceber:       { ver: "verAReceber",     ger: "gerenciarAReceber" },
  caixaDiario:    { ver: "verCaixaDiario",  ger: "gerenciarCaixaDiario" },
  despesas:       { ver: "verDespesas",     ger: "gerenciarDespesas" },
  mesas:          { ver: "verMesas",        ger: "gerenciarMesas" },
  alunos:         { ver: "verMatriculas",   ger: "gerenciarMatriculas" },
  vendedores:     { ver: "verVendedores",   ger: null },
  relatorios:     { ver: "verRelatorios",   ger: null },
  usuarios:       { ver: null,              ger: null }, // admin only
  configuracoes:  { ver: null,              ger: null }, // admin only
  agendamento:    { ver: "verAgendamento",  ger: "gerenciarAgendamento" },
  crm:            { ver: "verCRM",          ger: null },
};

// ─────────────────────────────────────────────
// Helpers de permissão — suportam novo e legado
// ─────────────────────────────────────────────
export const podeVer = (cargo, modulo, permissoesCustom) => {
  if (cargo === "admin") return true;
  if (permissoesCustom) {
    const map = MODULO_PERM[modulo];
    if (!map) return false;
    if (!map.ver) return false;
    return !!permissoesCustom[map.ver];
  }
  return !!(PERMISSOES[modulo]?.[cargo]?.includes("v"));
};

export const podeCriar = (cargo, modulo, permissoesCustom) => {
  if (cargo === "admin") return true;
  if (permissoesCustom) {
    const map = MODULO_PERM[modulo];
    if (!map?.ger) return false;
    return !!permissoesCustom[map.ger];
  }
  return !!(PERMISSOES[modulo]?.[cargo]?.includes("c"));
};

export const podeEditar = (cargo, modulo, permissoesCustom) => {
  if (cargo === "admin") return true;
  if (permissoesCustom) {
    const map = MODULO_PERM[modulo];
    if (!map?.ger) return false;
    return !!permissoesCustom[map.ger];
  }
  return !!(PERMISSOES[modulo]?.[cargo]?.includes("e"));
};

export const podeExcluir = (cargo, modulo, permissoesCustom) => {
  if (cargo === "admin") return true;
  if (permissoesCustom) {
    const map = MODULO_PERM[modulo];
    if (!map?.ger) return false;
    return !!permissoesCustom[map.ger];
  }
  return !!(PERMISSOES[modulo]?.[cargo]?.includes("x"));
};

export const podeVerRelatorio = (cargo, subRelatorio, permissoesCustom) => {
  if (cargo === "admin") return true;
  if (permissoesCustom) {
    const relMap = {
      dre: "verRelFinanceiro", financeiro: "verRelFinanceiro",
      despesas: "verRelDespesas", compras: "verRelCompras",
      estoque: "verRelEstoque", vendas: "verRelVendas",
      clientes: "verRelClientes", agenda: "verRelAgenda", pdv: "verRelPDV",
    };
    const perm = relMap[subRelatorio];
    if (!perm) return false;
    return !!permissoesCustom[perm];
  }
  return !!(PERMISSOES_RELATORIOS[subRelatorio]?.[cargo]);
};

// ─────────────────────────────────────────────
// Rate Limiting — proteção contra brute force
// ─────────────────────────────────────────────
const RL_MAX_TENTATIVAS = 5;
const RL_JANELA_MS      = 15 * 60 * 1000;
const RL_BLOQUEIO_MS    = 15 * 60 * 1000;

function rl_chave(email) {
  return `assent_rl_${email.toLowerCase().trim()}`;
}

function rl_verificar(email) {
  try {
    const raw = localStorage.getItem(rl_chave(email));
    if (!raw) return { bloqueado: false, tentativas: 0 };

    const dados = JSON.parse(raw);
    const agora = Date.now();

    if (agora - dados.inicio > RL_JANELA_MS) {
      localStorage.removeItem(rl_chave(email));
      return { bloqueado: false, tentativas: 0 };
    }

    if (dados.tentativas >= RL_MAX_TENTATIVAS) {
      const restanteMs  = RL_BLOQUEIO_MS - (agora - dados.inicio);
      const restanteMin = Math.ceil(restanteMs / 60000);
      return { bloqueado: true, tentativas: dados.tentativas, restanteMin };
    }

    return { bloqueado: false, tentativas: dados.tentativas };
  } catch {
    return { bloqueado: false, tentativas: 0 };
  }
}

function rl_registrarFalha(email) {
  try {
    const raw   = localStorage.getItem(rl_chave(email));
    const dados = raw ? JSON.parse(raw) : { tentativas: 0, inicio: Date.now() };

    localStorage.setItem(rl_chave(email), JSON.stringify({
      tentativas: dados.tentativas + 1,
      inicio:     dados.inicio ?? Date.now(),
    }));
  } catch { /* silencia erros de localStorage */ }
}

function rl_resetar(email) {
  try {
    localStorage.removeItem(rl_chave(email));
  } catch { /* silencia */ }
}

// ─────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]                         = useState(null);
  const [tenantUid, setTenantUid]               = useState(null);
  const [cargo, setCargo]                       = useState(null);
  const [vendedorId, setVendedorId]             = useState(null);
  const [vendedorNome, setVendedorNome]         = useState(null);
  const [nomeUsuario, setNomeUsuario]           = useState(null);
  const [permissoesCustom, setPermissoesCustom] = useState(null); // null = usa legado
  const [loadingAuth, setLoadingAuth]           = useState(true); // ← nasce true: trava render até Firebase responder

  // ── Limpa todo o estado de sessão ──────────────────────────────────
  const limparSessao = useCallback(() => {
    setUser(null);
    setTenantUid(null);
    setCargo(null);
    setVendedorId(null);
    setVendedorNome(null);
    setNomeUsuario(null);
    setPermissoesCustom(null);
  }, []);

  // ── Helper interno: rejeita acesso e garante estado limpo ──────────
  // Sempre chama limparSessao() ANTES de firebaseSignOut para que o estado
  // seja zerado imediatamente, sem esperar o onAuthStateChanged(null) disparar.
  // Isso elimina a janela de milissegundos onde user/tenantUid ficam com
  // valores stale após o signOut ser chamado dentro de carregarPerfil.
  const _rejeitarAcesso = useCallback(async (motivo) => {
    console.warn(`[AuthContext] Acesso rejeitado: ${motivo}`);
    limparSessao();
    await firebaseSignOut(auth);
  }, [limparSessao]);

  // ── Carrega o perfil do usuário no Firestore após autenticação ──────
  const carregarPerfil = useCallback(async (firebaseUser) => {
    try {
      const uid = firebaseUser.uid;

      // ── Passo 1: verifica se é o Admin/dono do tenant ──────────────
      const adminDoc = await getDoc(doc(db, "users", uid));
      if (adminDoc.exists()) {
        // ── DEPOIS de confirmar adminDoc.exists(), ANTES de setUser ──
// Verifica se a licença está ativa e o trial não expirou
const licencaDoc = await getDoc(doc(db, "licencas", uid));
if (licencaDoc.exists()) {
  const ld = licencaDoc.data();
  const ativo = ld.ativo === true;
  const plano = ld.plano ?? "trial";

  let trialExpirado = false;
  if (plano === "trial") {
    const expira = ld.trialExpira?.toDate?.() ?? null;
    trialExpirado = expira ? Date.now() > expira.getTime() : false;
  }

  if (!ativo || trialExpirado) {
    await _rejeitarAcesso(
      trialExpirado ? "Trial expirado." : "Licença inativa."
    );
    return;
  }
}
        setUser(firebaseUser);
        setTenantUid(uid);
        setCargo(CARGOS.ADMIN);
        setVendedorId(null);
        setVendedorNome(null);
        setNomeUsuario(firebaseUser.displayName || firebaseUser.email);
        return;
      }
      

      // ── Passo 1.5: pode ser Admin no primeiro acesso (bootstrapping) ──
      const licencaDoc = await getDoc(doc(db, "licencas", uid));

      if (licencaDoc.exists()) {
        const ld15 = licencaDoc.data();
        const plano15 = ld15.plano ?? "trial";
        let trialExpirado15 = false;
        if (plano15 === "trial") {
          const expira15 = ld15.trialExpira?.toDate?.() ?? null;
          trialExpirado15 = expira15 ? Date.now() > expira15.getTime() : false;
        }
        if (ld15.ativo !== true || trialExpirado15) {
          await _rejeitarAcesso(trialExpirado15 ? "Trial expirado." : "Licença inativa.");
          return;
        }
        // Licença ativa — primeiro acesso do Admin: cria documento base
        await setDoc(doc(db, "users", uid), {
          email:    firebaseUser.email,
          criadoEm: serverTimestamp(),
        }, { merge: true });

        setUser(firebaseUser);
        setTenantUid(uid);
        setCargo(CARGOS.ADMIN);
        setVendedorId(null);
        setVendedorNome(null);
        setNomeUsuario(firebaseUser.displayName || firebaseUser.email);
        return;
      }

      // ── Passo 2: usuário convidado — busca o tenant via índice ──────
      const indexDoc = await getDoc(doc(db, "userIndex", uid));
      if (!indexDoc.exists()) {
        await _rejeitarAcesso("userIndex não encontrado — usuário sem registro.");
        return;
      }

      const data = indexDoc.data();
      const tUid = data.tenantUid ?? data.tenantUID;

      // ── Passo 2.5: verifica licença + trial do tenant ──────────────
      const licencaTenantDoc = await getDoc(doc(db, "licencas", tUid));
      if (licencaTenantDoc.exists()) {
        const lt = licencaTenantDoc.data();
        const planoT = lt.plano ?? "trial";
        let trialExpiradoT = false;
        if (planoT === "trial") {
          const expiraT = lt.trialExpira?.toDate?.() ?? null;
          trialExpiradoT = expiraT ? Date.now() > expiraT.getTime() : false;
        }
        if (lt.ativo !== true || trialExpiradoT) {
          await _rejeitarAcesso(
            trialExpiradoT
              ? "Trial da empresa expirado."
              : "Licença da empresa inativa."
          );
          return;
        }
      }

      // ── Passo 3: lê o perfil em /users/{tenantUid}/usuarios/{uid} ───
      const perfilDoc = await getDoc(doc(db, "users", tUid, "usuarios", uid));
      if (!perfilDoc.exists()) {
        await _rejeitarAcesso("Documento de usuário convidado não encontrado.");
        return;
      }

      const perfil = perfilDoc.data();

      // Bloqueia usuário desativado
      if (perfil.ativo === false) {
        await _rejeitarAcesso("Usuário desativado.");
        return;
      }

      setUser(firebaseUser);
      setTenantUid(tUid);
      setCargo(perfil.cargo);
      setNomeUsuario(perfil.nome || firebaseUser.email);

      // ── Passo 4: se cargo === "vendedor", carrega dados do cadastro vinculado ──
      // CRÍTICO: lógica de vendedorId mantida idêntica para comissões/relatórios
      if (perfil.cargo === CARGOS.VENDEDOR && perfil.vendedorId) {
        const vendedorDoc = await getDoc(
          doc(db, "users", tUid, "vendedores", perfil.vendedorId)
        );
        setVendedorId(perfil.vendedorId);
        setVendedorNome(vendedorDoc.exists() ? (vendedorDoc.data().nome ?? null) : null);
      } else {
        setVendedorId(null);
        setVendedorNome(null);
      }

      // ── Passo 5: carrega permissões customizadas do cargo (novo sistema) ──
      try {
        const cargoKey = perfil.cargo;
        if (cargoKey && cargoKey !== "admin") {
          const cargoDoc = await getDoc(doc(db, "users", tUid, "cargos", cargoKey));
          if (cargoDoc.exists() && cargoDoc.data().permissoes) {
            setPermissoesCustom(cargoDoc.data().permissoes);
          } else {
            // Fallback: usa permissões padrão do cargo se existirem
            setPermissoesCustom(PERMISSOES_PADRAO_CARGO[cargoKey] ?? null);
          }
        } else {
          setPermissoesCustom(null);
        }
      } catch {
        setPermissoesCustom(null);
      }
    } catch (err) {
      console.error("[AuthContext] Erro ao carregar perfil:", err);
      limparSessao();
    }
  }, [limparSessao, _rejeitarAcesso]);

  // ── Listener do Firebase Auth ───────────────────────────────────────
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        await carregarPerfil(firebaseUser);
      } else {
        limparSessao();
      }
      setLoadingAuth(false);
    });
    return () => unsubscribe();
  }, [carregarPerfil, limparSessao]);

  // ── signIn com Rate Limiting ────────────────────────────────────────
  const signIn = useCallback(async (email, password) => {
    const { bloqueado, restanteMin } = rl_verificar(email);
    if (bloqueado) {
      throw Object.assign(
        new Error(`Muitas tentativas de login. Tente novamente em ${restanteMin} minuto${restanteMin !== 1 ? "s" : ""}.`),
        { code: "auth/rate-limit-exceeded" }
      );
    }

    setLoadingAuth(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      rl_resetar(email);
      // carregarPerfil é disparado pelo onAuthStateChanged
    } catch (err) {
      setLoadingAuth(false);

      const errosDeCredencial = [
        "auth/invalid-credential",
        "auth/wrong-password",
        "auth/user-not-found",
        "auth/invalid-email",
        "auth/too-many-requests",
      ];

      if (errosDeCredencial.includes(err.code)) {
        rl_registrarFalha(email);

        const { tentativas } = rl_verificar(email);
        const restam = RL_MAX_TENTATIVAS - tentativas;

        if (restam <= 0) {
          throw Object.assign(
            new Error(`Conta bloqueada por ${RL_BLOQUEIO_MS / 60000} minutos devido a muitas tentativas incorretas.`),
            { code: "auth/rate-limit-exceeded" }
          );
        }

        if (restam <= 2) {
          throw Object.assign(
            new Error(`E-mail ou senha incorretos. Atenção: mais ${restam} tentativa${restam !== 1 ? "s" : ""} antes do bloqueio temporário.`),
            { code: err.code }
          );
        }
      }

      throw err;
    }
  }, []);

  // ── signOut ─────────────────────────────────────────────────────────
  const signOut = useCallback(async () => {
    await firebaseSignOut(auth);
    // o listener limpa o estado automaticamente via limparSessao()
  }, []);

  // ── Helpers de permissão prontos para uso nos componentes ───────────
  const perm = {
    podeVer:          (modulo) => podeVer(cargo, modulo, permissoesCustom),
    podeCriar:        (modulo) => podeCriar(cargo, modulo, permissoesCustom),
    podeEditar:       (modulo) => podeEditar(cargo, modulo, permissoesCustom),
    podeExcluir:      (modulo) => podeExcluir(cargo, modulo, permissoesCustom),
    podeVerRelatorio: (sub)    => podeVerRelatorio(cargo, sub, permissoesCustom),
    // Permissão granular direta — para uso na UI de cargos
    temPermissao:     (chave)  => cargo === "admin" || !!(permissoesCustom?.[chave]),
    permissoesCustom,
    isAdmin:    cargo === CARGOS.ADMIN,
    isVendedor: cargo === CARGOS.VENDEDOR,
  };

  // ─────────────────────────────────────────────
  // Value exposto para toda a aplicação
  // ─────────────────────────────────────────────
  const value = {
    // ── Identidade ──
    user,           // Firebase Auth user (uid, email, displayName…)
    cargo,          // "admin" | "financeiro" | "comercial" | "compras" | "operacional" | "vendedor" | "suporte"
    tenantUid,      // uid do dono do tenant — raiz das queries Firestore: /users/{tenantUid}/...
    vendedorId,     // id em /vendedores — null se cargo !== "vendedor" ou sem vínculo
    vendedorNome,   // nome para exibição no select travado em Vendas.jsx
    nomeUsuario,    // nome real do Firestore para exibição no header
    loadingAuth,    // true enquanto o perfil ainda está sendo carregado

    // ── Flag de autenticação de aplicação (Firebase Auth + Firestore validado) ──
    // Use isAuthenticated nos guards, não user !== null.
    // user pode existir no Firebase mas sem registro no Firestore.
    isAuthenticated: !!tenantUid,

    // ── Ações ──
    signIn,
    signOut,

    // ── Permissões (shortcuts) ──
    ...perm,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// ─────────────────────────────────────────────
// Hook de consumo
// ─────────────────────────────────────────────
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de <AuthProvider>");
  return ctx;
}

export default AuthContext;
