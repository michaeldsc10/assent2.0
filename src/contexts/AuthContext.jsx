// AuthContext.jsx — ASSENT v2.0
// Expõe: { user, cargo, tenantUid, vendedorId, vendedorNome, loadingAuth, signIn, signOut, permissoes }
// Integrado com Firebase Auth + Firestore (estrutura multi-tenant)

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
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
  aReceber:       { admin: "vcex", financeiro: "vce", comercial: "v",   compras: "",    operacional: "",    vendedor: "",    suporte: ""   },
  caixaDiario:    { admin: "vcex", financeiro: "vce", comercial: "",    compras: "",    operacional: "vc",  vendedor: "",    suporte: ""   },
  despesas:       { admin: "vcex", financeiro: "vce", comercial: "",    compras: "vc",  operacional: "",    vendedor: "",    suporte: ""   },
  // Todos veem o menu Relatórios; sub-relatórios são bloqueados internamente com cadeado
  relatorios:     { admin: "v",    financeiro: "v",   comercial: "v",   compras: "v",   operacional: "v",   vendedor: "v",   suporte: "v"  },
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
// Context
// ─────────────────────────────────────────────
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]                   = useState(null);  // Firebase Auth user
  const [tenantUid, setTenantUid]         = useState(null);  // uid do dono/Admin do tenant
  const [cargo, setCargo]                 = useState(null);  // string do cargo
  const [vendedorId, setVendedorId]       = useState(null);  // id em /vendedores
  const [vendedorNome, setVendedorNome]   = useState(null);  // nome para exibição
  const [loadingAuth, setLoadingAuth]     = useState(true);

  // ── Limpa todo o estado de sessão ──
  const limparSessao = useCallback(() => {
    setUser(null);
    setTenantUid(null);
    setCargo(null);
    setVendedorId(null);
    setVendedorNome(null);
  }, []);

  // ── Carrega o perfil do usuário no Firestore após autenticação ──
  const carregarPerfil = useCallback(async (firebaseUser) => {
    try {
      const uid = firebaseUser.uid;

      // ── Passo 1: verifica se é o Admin/dono do tenant ──
      // O Admin é identificado por ter um documento em /users/{uid} na raiz
      const adminDoc = await getDoc(doc(db, "users", uid));

      if (adminDoc.exists()) {
        setUser(firebaseUser);
        setTenantUid(uid);
        setCargo(CARGOS.ADMIN);
        setVendedorId(null);
        setVendedorNome(null);
        return;
      }

      // ── Passo 2: usuário convidado — busca o tenant via índice ──
      // Ao convidar um usuário, o Admin grava /userIndex/{uid} → { tenantUid }
      // Isso evita varrer todos os tenants para localizar o usuário.
      const indexDoc = await getDoc(doc(db, "userIndex", uid));

      if (!indexDoc.exists()) {
        console.error("[AuthContext] userIndex não encontrado para uid:", uid);
        await firebaseSignOut(auth);
        return;
      }

      const { tenantUid: tUid } = indexDoc.data();

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

  // ── signIn ──
  const signIn = useCallback(async (email, password) => {
    setLoadingAuth(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // carregarPerfil é disparado pelo onAuthStateChanged
    } catch (err) {
      setLoadingAuth(false);
      throw err; // repassa para o componente de login exibir o erro
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
