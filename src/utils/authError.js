/* ═══════════════════════════════════════════════════
   ASSENT v2.0 — authError.js
   Converte códigos de erro do Firebase Auth em
   mensagens seguras para exibir ao usuário.

   PROBLEMA que resolve:
   Firebase lança err.message como:
     "Firebase: Error (auth/wrong-password)."
   Isso revela que o e-mail existe no sistema.
   Esta função mapeia para mensagens genéricas e seguras.

   USO:
     import { authErrorMessage } from '@/utils/authError';
     } catch (err) { setError(authErrorMessage(err)); }
   ═══════════════════════════════════════════════════ */

// Mensagem genérica padrão — nunca revela qual campo está errado
const DEFAULT_MSG = 'E-mail ou senha incorretos. Tente novamente.';

const ERROR_MAP = {
  // ── Credenciais ──────────────────────────────────
  'auth/wrong-password':          DEFAULT_MSG,
  'auth/user-not-found':          DEFAULT_MSG, // CRÍTICO: não revelar que e-mail não existe
  'auth/invalid-credential':      DEFAULT_MSG,
  'auth/invalid-email':           'E-mail inválido. Verifique o formato.',
  'auth/user-disabled':           'Esta conta foi desativada. Contate o administrador.',

  // ── Bloqueios ────────────────────────────────────
  'auth/too-many-requests':       'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
  'auth/network-request-failed':  'Sem conexão. Verifique sua internet.',

  // ── Recuperação de senha ─────────────────────────
  'auth/missing-email':           'Informe um e-mail válido.',

  // ── Sessão ──────────────────────────────────────
  'auth/requires-recent-login':   'Por segurança, faça login novamente para continuar.',
};

/**
 * @param {Error} err - Erro capturado do Firebase Auth
 * @returns {string}  - Mensagem segura para exibir ao usuário
 */
export function authErrorMessage(err) {
  // Extrai o código limpo: "auth/wrong-password"
  const raw  = err?.code ?? '';
  const code = raw.replace(/^Firebase:\s*/i, '').trim();

  return ERROR_MAP[code] ?? DEFAULT_MSG;
}
