/* ═══════════════════════════════════════════════════
   ASSENT v2.0 — firestoreError.js
   Handler centralizado de erros do Firestore.

   USO:
     import { fsError, fsSnapshotError } from '@/utils/firestoreError';

     // em blocos catch:
     } catch (err) { fsError(err, 'Vendas:criarVenda'); }

     // como 3º argumento do onSnapshot:
     onSnapshot(q, (snap) => { ... }, fsSnapshotError('Vendas'))
   ═══════════════════════════════════════════════════ */

const IS_PROD = import.meta.env.PROD;

// ── Códigos que NÃO devem gerar nenhum ruído ────────
// (ex: permissão negada a usuário não autenticado ainda)
const SILENT_CODES = new Set([
  'permission-denied',
  'unauthenticated',
  'not-found',          // documento ainda não existe — situação normal
]);

/**
 * Trata erros de operações Firestore (getDocs, addDoc, updateDoc, etc.)
 *
 * @param {Error} err     - O erro capturado no catch
 * @param {string} ctx    - Contexto legível: 'Modulo:operacao'
 */
export function fsError(err, ctx = '') {
  if (IS_PROD) return; // Produção: silêncio total no console

  const code = err?.code ?? 'unknown';

  if (SILENT_CODES.has(code)) return; // erros esperados: não polui o log

  // Desenvolvimento: loga apenas código + contexto, nunca o payload completo
  console.warn(`[Firestore:${ctx}]`, code);
}

/**
 * Retorna o handler de erro pronto para o 3º argumento do onSnapshot.
 *
 * @param {string} ctx - Contexto legível: 'NomeDoModulo'
 * @returns {(err: Error) => void}
 */
export function fsSnapshotError(ctx = '') {
  return (err) => fsError(err, `${ctx}:snapshot`);
}
