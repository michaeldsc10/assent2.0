// logAction.js — ASSENT v2.0
// Utilitário central de Log de Atividades
//
// USO em qualquer módulo:
//   import { logAction } from "../lib/logAction";
//
//   await logAction({
//     tenantUid,          // uid do tenant (de useAuth)
//     nomeUsuario,        // nome do usuário logado (de useAuth)
//     cargo,              // cargo do usuário (de useAuth)
//     acao,               // "criar" | "editar" | "excluir"
//     modulo,             // ex: "Clientes", "Vendas", "Produtos"
//     descricao,          // ex: "Cliente João Silva (ID: CLI-001)"
//     extra,              // (opcional) objeto com dados adicionais
//   });
//
// Estrutura Firestore:
//   users/{tenantUid}/logs/{autoId}
//   {
//     nomeUsuario, cargo, acao, modulo,
//     descricao, extra, timestamp (ISO string), criadoEm (serverTimestamp)
//   }

import { db } from "../lib/firebase"; // ajuste o caminho conforme seu projeto
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

// ─────────────────────────────────────────────
// Ações canônicas — use estas constantes nos módulos
// ─────────────────────────────────────────────
export const LOG_ACAO = {
  CRIAR:   "criar",
  EDITAR:  "editar",
  EXCLUIR: "excluir",
};

// ─────────────────────────────────────────────
// Módulos canônicos — correspondem aos nomes de exibição
// ─────────────────────────────────────────────
export const LOG_MODULO = {
  AGENDA:          "Agenda",
  A_RECEBER:       "A Receber",
  CAIXA_DIARIO:    "Caixa Diário",
  CLIENTES:        "Clientes",
  COMPRAS:         "Compras",
  CONFIGURACOES:   "Configurações",
  DESPESAS:        "Despesas",
  ENTRADA_ESTOQUE: "Entrada de Estoque",
  FORNECEDORES:    "Fornecedores",
  MESAS:           "Mesas",
  ORCAMENTOS:      "Orçamentos",
  PRODUTOS:        "Produtos",
  SERVICOS:        "Serviços",
  VENDAS:          "Vendas",
  VENDEDORES:      "Vendedores",
  USUARIOS:        "Usuários",
};

// ─────────────────────────────────────────────
// Função principal
// ─────────────────────────────────────────────
/**
 * Registra uma ação no log de atividades do tenant.
 *
 * @param {object} params
 * @param {string}  params.tenantUid    - uid do tenant (obrigatório)
 * @param {string}  params.nomeUsuario  - nome do usuário que realizou a ação
 * @param {string}  params.cargo        - cargo do usuário
 * @param {string}  params.acao         - "criar" | "editar" | "excluir"
 * @param {string}  params.modulo       - nome do módulo (ex: "Clientes")
 * @param {string}  params.descricao    - descrição legível da ação
 * @param {object}  [params.extra]      - dados adicionais opcionais (objeto livre)
 * @returns {Promise<void>}
 */
export async function logAction({
  tenantUid,
  nomeUsuario,
  cargo,
  acao,
  modulo,
  descricao,
  extra = null,
}) {
  if (!tenantUid) {
    console.warn("[logAction] tenantUid ausente — log não registrado.");
    return;
  }

  try {
    const entrada = {
      nomeUsuario: nomeUsuario || "Desconhecido",
      cargo:       cargo       || "—",
      acao,
      modulo,
      descricao,
      timestamp:   new Date().toISOString(), // para exibição rápida sem query extra
      criadoEm:    serverTimestamp(),         // para ordenação confiável no Firestore
    };

    if (extra && typeof extra === "object") {
      entrada.extra = extra;
    }

    await addDoc(collection(db, "users", tenantUid, "logs"), entrada);
  } catch (err) {
    // Log nunca deve quebrar a UX — apenas avisa no console
    console.error("[logAction] Falha ao gravar log:", err);
  }
}

// ─────────────────────────────────────────────
// Helper: monta uma descrição padronizada
// (opcional — use quando quiser consistência)
// ─────────────────────────────────────────────
/**
 * Monta uma string de descrição padronizada.
 * Ex: montarDescricao("criar", "Cliente", "João Silva", "CLI-001")
 *     → "Criou Cliente: João Silva (ID: CLI-001)"
 *
 * @param {string} acao      - "criar" | "editar" | "excluir"
 * @param {string} entidade  - nome da entidade (ex: "Cliente", "Produto")
 * @param {string} nome      - nome do registro afetado
 * @param {string} [id]      - id do registro (opcional)
 * @returns {string}
 */
export function montarDescricao(acao, entidade, nome, id) {
  const verbo = { criar: "Criou", editar: "Editou", excluir: "Excluiu" }[acao] ?? acao;
  const idPart = id ? ` (ID: ${id})` : "";
  return `${verbo} ${entidade}: ${nome}${idPart}`;
}
