/* ═══════════════════════════════════════════════════
   ASSENT v2.0 — functions/index.js
   Cloud Functions com validação de cargo no servidor
   + App Check obrigatório (enforceAppCheck)
   + CORS restrito ao domínio da Vercel
   ═══════════════════════════════════════════════════ */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

admin.initializeApp();

const db     = admin.firestore();
const fbAuth = admin.auth();

/* ─────────────────────────────────────────────
   CONFIGURAÇÃO GLOBAL DAS FUNÇÕES
   enforceAppCheck → rejeita chamadas sem token App Check válido
   cors            → só aceita requisições do seu domínio
───────────────────────────────────────────── */
const CALL_OPTIONS = {
  enforceAppCheck: true,
  cors: [
    "https://ag.assentagencia.com.br",    // domínio próprio
    "https://assent2-0.vercel.app",       // domínio Vercel
    "http://localhost:5173",           // dev local (Vite padrão)
    "http://localhost:3000",           // dev local alternativo
  ],
};

/* ─────────────────────────────────────────────
   HELPER: Verifica se o caller é Admin legítimo
   Admin = tem documento em licencas/{uid}
   tenantUid = próprio uid do admin
───────────────────────────────────────────── */
async function verificarAdmin(callerUid) {
  if (!callerUid) {
    throw new HttpsError("unauthenticated", "Usuário não autenticado.");
  }

  const licencaSnap = await db.doc(`licencas/${callerUid}`).get();

  if (!licencaSnap.exists) {
    throw new HttpsError("permission-denied", "Acesso negado. Apenas administradores podem executar esta ação.");
  }

  const licenca = licencaSnap.data();
  if (!licenca.clienteAG) {
    throw new HttpsError("permission-denied", "Licença inválida.");
  }

  return callerUid;
}

/* ─────────────────────────────────────────────
   FUNÇÃO 1: Criar Usuário
───────────────────────────────────────────── */
exports.criarUsuario = onCall(CALL_OPTIONS, async (request) => {
  const tenantUid = await verificarAdmin(request.auth?.uid);

  const { nome, email, senha, cargo, vendedorId } = request.data;

  if (!nome || !email || !senha || !cargo) {
    throw new HttpsError("invalid-argument", "Campos obrigatórios ausentes.");
  }

  const CARGOS_VALIDOS = ["financeiro", "comercial", "compras", "operacional", "vendedor", "suporte"];
  if (!CARGOS_VALIDOS.includes(cargo)) {
    throw new HttpsError("invalid-argument", "Cargo inválido.");
  }

  if (senha.length < 6) {
    throw new HttpsError("invalid-argument", "Senha deve ter no mínimo 6 caracteres.");
  }

  const usuariosSnap = await db.collection(`users/${tenantUid}/usuarios`).get();
  const ativos = usuariosSnap.docs.filter(d => d.data().ativo !== false).length;
  if (ativos >= 10) {
    throw new HttpsError("resource-exhausted", "Limite de 10 usuários adicionais atingido.");
  }

  let novoUid;
  try {
    const userRecord = await fbAuth.createUser({ email, password: senha });
    novoUid = userRecord.uid;
  } catch (err) {
    if (err.code === "auth/email-already-exists") {
      throw new HttpsError("already-exists", "Este e-mail já está em uso.");
    }
    if (err.code === "auth/invalid-email") {
      throw new HttpsError("invalid-argument", "E-mail inválido.");
    }
    throw new HttpsError("internal", "Erro ao criar usuário no Auth.");
  }

  await db.doc(`users/${tenantUid}/usuarios/${novoUid}`).set({
    nome,
    email,
    cargo,
    vendedorId: cargo === "vendedor" ? (vendedorId || null) : null,
    ativo:      true,
    criadoEm:  admin.firestore.FieldValue.serverTimestamp(),
    criadoPor: tenantUid,
  });

  await db.doc(`userIndex/${novoUid}`).set({
    tenantUid,
    criadoEm: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { uid: novoUid, nome };
});

/* ─────────────────────────────────────────────
   FUNÇÃO 2: Editar Usuário
───────────────────────────────────────────── */
exports.editarUsuario = onCall(CALL_OPTIONS, async (request) => {
  const tenantUid = await verificarAdmin(request.auth?.uid);

  const { uid, nome, cargo, vendedorId } = request.data;

  if (!uid || !nome || !cargo) {
    throw new HttpsError("invalid-argument", "Campos obrigatórios ausentes.");
  }

  const CARGOS_VALIDOS = ["financeiro", "comercial", "compras", "operacional", "vendedor", "suporte"];
  if (!CARGOS_VALIDOS.includes(cargo)) {
    throw new HttpsError("invalid-argument", "Cargo inválido.");
  }

  const usuarioSnap = await db.doc(`users/${tenantUid}/usuarios/${uid}`).get();
  if (!usuarioSnap.exists) {
    throw new HttpsError("not-found", "Usuário não encontrado nesta conta.");
  }

  await db.doc(`users/${tenantUid}/usuarios/${uid}`).update({
    nome,
    cargo,
    vendedorId:   cargo === "vendedor" ? (vendedorId || null) : null,
    atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { ok: true, nome };
});

/* ─────────────────────────────────────────────
   FUNÇÃO 3: Excluir Usuário
───────────────────────────────────────────── */
exports.excluirUsuario = onCall(CALL_OPTIONS, async (request) => {
  const tenantUid = await verificarAdmin(request.auth?.uid);

  const { uid } = request.data;

  if (!uid) {
    throw new HttpsError("invalid-argument", "UID do usuário é obrigatório.");
  }

  const usuarioSnap = await db.doc(`users/${tenantUid}/usuarios/${uid}`).get();
  if (!usuarioSnap.exists) {
    throw new HttpsError("not-found", "Usuário não encontrado nesta conta.");
  }

  const nome = usuarioSnap.data().nome;

  await db.doc(`users/${tenantUid}/usuarios/${uid}`).delete();
  await db.doc(`userIndex/${uid}`).delete();

  try {
    await fbAuth.deleteUser(uid);
  } catch (err) {
    console.warn(`[excluirUsuario] Auth.deleteUser falhou para ${uid}:`, err.code);
  }

  return { ok: true, nome };
});
