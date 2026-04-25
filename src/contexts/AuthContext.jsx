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
// Matriz de permissões por módulo e cargo
// Níveis: "vcex" | "vce" | "vc" | "ve" | "v" | ""
// v = ver · c = criar · e = editar · x = excluir
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
  alunos:         { admin: "vcex", financeiro: "v",   comercial: "vce", compras: "",    operacional: "v",   vendedor: "v",   suporte: ""   },
  aReceber:       { admin: "vcex", financeiro: "vce", comercial: "v",   compras: "",    operacional: "",    vendedor: "",    suporte: ""   },
  caixaDiario:    { admin: "vcex", financeiro: "vce", comercial: "",    compras: "",    operacional: "vc",  vendedor: "",    suporte: ""   },
  despesas:       { admin: "vcex", financeiro: "vce", comercial: "",    compras: "vc",  operacional: "",    vendedor: "",    suporte: ""   },
  // Todos veem o menu Relatórios; sub-relatórios são bloqueados internamente com cadeado
  relatorios:     { admin: "v",    financeiro: "v",   comercial: "v",   compras: "v",   operacional: "v",   vendedor: "v",   suporte: "v"  },
  mesas:          { admin: "vcex", financeiro: "v",   comercial: "vce", compras: "",    operacional: "vce", vendedor: "vc",  suporte: ""   },
  usuarios:       { admin: "vcex", financeiro: "",    comercial: "",    compras: "",    operacional: "",    vendedor: "",    suporte: ""   },
  configuracoes:  { admin: "vcex", financeiro: "",    comercial: "",    compras: "",    operacional: "",    vendedor: "",    suporte: ""   },
};

// ─────────────────────────────────────────────
// Sub-relatórios — quem pode ver cada um
// ─────────────────────────────────────────────
export const PERMISSOES_RELATORIOS = {
  dre:        { admin: true, financeiro: true,  comercial: false, compras: false, operacional: false, vendedor: false, suporte: false },
  financeiro: { admin: true, financeiro: true,  comercial: false, compras: false, operacional: false, vendedor: false, suporte: false },
  despesas:   { admin: true, financeiro: true,  comercial: false, compras: false, operacional: false, vendedor: false, suporte: false },
  compras:    { admin: true, financeiro: true,  comercial: false, compras: true,  operacional: false, vendedor: false, suporte: false },
  estoque:    { admin: true, financeiro: true,  comercial: true,  compras: true,  operacional: true,  vendedor: true,  suporte: false },
  vendas:     { admin: true, financeiro: true,  comercial: true,  compras: false, operacional: false, vendedor: true,  suporte: true  },
  clientes:   { admin: true, financeiro: false, comercial: true,  compras: false, operacional: false, vendedor: true,  suporte: true  },
  agenda:     { admin: true, financeiro: false, comercial: true,  compras: false, operacional: false, vendedor: true,  suporte: true  },
};

// ─────────────────────────────────────────────
// Helpers de permissão (uso standalone fora do hook)
// ─────────────────────────────────────────────
export const podeVer          = (cargo, modulo)      => !!(PERMISSOES[modulo]?.[cargo]?.includes("v"));
export const podeCriar        = (cargo, modulo)      => !!(PERMISSOES[modulo]?.[cargo]?.includes("c"));
export const podeEditar       = (cargo, modulo)      => !!(PERMISSOES[modulo]?.[cargo]?.includes("e"));
export const podeExcluir      = (cargo, modulo)      => !!(PERMISSOES[modulo]?.[cargo]?.includes("x"));
export const podeVerRelatorio = (cargo, subRelatorio) => !!(PERMISSOES_RELATORIOS[subRelatorio]?.[cargo]);

// ─────────────────────────────────────────────
// Rate Limiting — proteção contra brute force
// ─────────────────────────────────────────────
const RL_MAX_TENTATIVAS = 5;          // tentativas antes de bloquear
const RL_JANELA_MS      = 15 * 60 * 1000; // janela de 15 minutos
const RL_BLOQUEIO_MS    = 15 * 60 * 1000; // tempo de bloqueio após exceder

function rl_chave(email) {
  return `assent_rl_${email.toLowerCase().trim()}`;
}

function rl_verificar(email) {
  try {
    const raw = localStorage.getItem(rl_chave(email));
    if (!raw) return { bloqueado: false, tentativas: 0 };

    const dados = JSON.parse(raw);
    const agora = Date.now();

    // Janela expirou — limpa automaticamente
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
  const [user, setUser]                   = useState(null);  // Firebase Auth user
  const [tenantUid, setTenantUid]         = useState(null);  // uid do dono/Admin do tenant
  const [cargo, setCargo]                 = useState(null);  // string do cargo
  const [vendedorId, setVendedorId]       = useState(null);  // id em /vendedores
  const [vendedorNome, setVendedorNome]   = useState(null);  // nome para exibição
  const [nomeUsuario, setNomeUsuario]     = useState(null);  // nome do Firestore (admin e convidados)
  const [loadingAuth, setLoadingAuth]     = useState(true);

  // ── Limpa todo o estado de sessão ──
  const limparSessao = useCallback(() => {
    setUser(null);
    setTenantUid(null);
    setCargo(null);
    setVendedorId(null);
    setVendedorNome(null);
    setNomeUsuario(null);
  }, []);

  // ── Carrega o perfil do usuário no Firestore após autenticação ──
  const carregarPerfil = useCallback(async (firebaseUser) => {
    try {
      const uid = firebaseUser.uid;

      // ── Passo 1: verifica se é o Admin/dono do tenant ──
      const adminDoc = await getDoc(doc(db, "users", uid));
      if (adminDoc.exists()) {
        setUser(firebaseUser);
        setTenantUid(uid);
        setCargo(CARGOS.ADMIN);
        setVendedorId(null);
        setVendedorNome(null);
        setNomeUsuario(firebaseUser.displayName || firebaseUser.email);
        return;
      }

      // ── Passo 1.5: users/{uid} não existe — pode ser Admin no primeiro acesso ──
      const licencaDoc = await getDoc(doc(db, "licencas", uid));

      if (licencaDoc.exists()) {
        if (licencaDoc.data().ativo !== true) {
          console.warn("[AuthContext] Licença inativa. Acesso bloqueado.");
          await firebaseSignOut(auth);
          return;
        }
        // Licença ativa — primeiro acesso do Admin
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

      // ── Passo 2: usuário convidado — busca o tenant via índice ──
      const indexDoc = await getDoc(doc(db, "userIndex", uid));
      if (!indexDoc.exists()) {
        console.error("[AuthContext] userIndex não encontrado");
        await firebaseSignOut(auth);
        return;
      }

      const data = indexDoc.data();
      const tUid = data.tenantUid ?? data.tenantUID;

      // ── Passo 3: lê o perfil em /users/{tenantUid}/usuarios/{uid} ──
      const perfilDoc = await getDoc(doc(db, "users", tUid, "usuarios", uid));
      if (!perfilDoc.exists()) {
        console.error("[AuthContext] Documento de usuário convidado não encontrado.");
        await firebaseSignOut(auth);
        return;
      }

      const perfil = perfilDoc.data();

      // Bloqueia usuário desativado
      if (!perfil.ativo) {
        console.warn("[AuthContext] Usuário desativado. Acesso negado.");
        await firebaseSignOut(auth);
        return;
      }

      setUser(firebaseUser);
      setTenantUid(tUid);
      setCargo(perfil.cargo);
      setNomeUsuario(perfil.nome || firebaseUser.email);

      // ── Passo 4: se cargo === "vendedor", carrega dados do cadastro vinculado ──
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
    } catch (err) {
      console.error("[AuthContext] Erro ao carregar perfil:", err);
      limparSessao();
    }
  }, [limparSessao]);

  // ── Listener do Firebase Auth ──
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

  // ── signIn com Rate Limiting ──
  const signIn = useCallback(async (email, password) => {
    // ── 1. Checa se o usuário está bloqueado ──
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
      // ── Login bem-sucedido: zera o contador do email ──
      rl_resetar(email);
      // carregarPerfil é disparado pelo onAuthStateChanged
    } catch (err) {
      setLoadingAuth(false);

      // ── Registra falha apenas para erros de credencial (não para erros de rede etc.) ──
      const errosDeCredencial = [
        "auth/invalid-credential",
        "auth/wrong-password",
        "auth/user-not-found",
        "auth/invalid-email",
        "auth/too-many-requests",
      ];

      if (errosDeCredencial.includes(err.code)) {
        rl_registrarFalha(email);

        // Verifica quantas tentativas restam e enriquece a mensagem de erro
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

      throw err; // repassa para o componente de login exibir o erro original
    }
  }, []);

  // ── signOut ──
  const signOut = useCallback(async () => {
    await firebaseSignOut(auth);
    // o listener limpa o estado automaticamente
  }, []);

  // ── Helpers de permissão prontos para uso nos componentes ──
  const perm = {
    podeVer:          (modulo) => podeVer(cargo, modulo),
    podeCriar:        (modulo) => podeCriar(cargo, modulo),
    podeEditar:       (modulo) => podeEditar(cargo, modulo),
    podeExcluir:      (modulo) => podeExcluir(cargo, modulo),
    podeVerRelatorio: (sub)    => podeVerRelatorio(cargo, sub),
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
