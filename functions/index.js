/* ═══════════════════════════════════════════════════
   ASSENT v2.0 — functions/index.js
   Cloud Functions com validação de cargo no servidor
   + App Check obrigatório (enforceAppCheck)
   + CORS restrito ao domínio da Vercel
   ═══════════════════════════════════════════════════ */
const { onSchedule }              = require("firebase-functions/v2/scheduler");
const { onDocumentCreated }       = require("firebase-functions/v2/firestore");
const { onCall, onRequest,
        HttpsError }              = require("firebase-functions/v2/https");
const { getFirestore,
        Timestamp, FieldValue }   = require("firebase-admin/firestore");
const admin                       = require("firebase-admin");
const Stripe                      = require("stripe");
const nodemailer                  = require("nodemailer");
const { defineSecret }            = require("firebase-functions/params");

admin.initializeApp();

/* ─── Secrets Stripe + Email (Firebase Secret Manager) ─── */
const STRIPE_SECRET_KEY      = defineSecret("STRIPE_SECRET_KEY");
const STRIPE_WEBHOOK_SECRET  = defineSecret("STRIPE_WEBHOOK_SECRET");
const STRIPE_TEST_SECRET_KEY = defineSecret("STRIPE_TEST_SECRET_KEY");
const STRIPE_TEST_WEBHOOK    = defineSecret("STRIPE_TEST_WEBHOOK_SECRET");
const MAIL_USER              = defineSecret("MAIL_USER");
const MAIL_PASS              = defineSecret("MAIL_PASS");

/* Limites por plano — espelha o schema do atualizarPlano existente */
const LIMITES_PLANO = {
  trial:        { vendasMes: 500,  loginsExtras: 5,  alunos: 500  },
  essencial:    { vendasMes: 500,  loginsExtras: 5,  alunos: 500  },
  profissional: { vendasMes: 1500, loginsExtras: 15, alunos: 1000 },
};

const FEATURES_PLANO = {
  trial:        { instaInsights: false },
  essencial:    { instaInsights: false },
  profissional: { instaInsights: true  },
};

/* ─── Importa funções de notificacoes ─── */
const notificacoesFunctions = require('./src/notificacoes');

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
    "https://ag.assentagencia.com.br",
    "https://assent2-0.vercel.app",
    "http://localhost:5173",
    "http://localhost:3000",
  ],
};

const ADMIN_CALL_OPTIONS = {
  enforceAppCheck: false,
  cors: [
    "https://ag.assentagencia.com.br",
    "https://assent2-0.vercel.app",
    "http://localhost:5173",
    "http://localhost:3000",
  ],
};

/* Opções para as funções PIX — onRequest com CORS manual */
const PIX_ORIGINS = new Set([
  "https://ag.assentagencia.com.br",
  "https://assent2-0.vercel.app",
  "http://localhost:5173",
  "http://localhost:3000",
]);

/* Helper: aplica CORS e retorna false se for preflight já respondido */
function applyCors(req, res) {
  const origin = req.headers.origin || "";
  const allowed = PIX_ORIGINS.has(origin) ? origin : [...PIX_ORIGINS][0];
  res.set("Access-Control-Allow-Origin",  allowed);
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.set("Access-Control-Max-Age",       "3600");
  if (req.method === "OPTIONS") { res.status(204).send(""); return false; }
  return true;
}

/* Helper: verifica token Firebase Auth e retorna uid */
async function verificarAuth(req) {
  const header = req.headers.authorization || "";
  const token  = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;
  try {
    const decoded = await fbAuth.verifyIdToken(token);
    return decoded.uid;
  } catch { return null; }
}

/* ─────────────────────────────────────────────
   FUNÇÃO 4: gerarPixQr  (onRequest — CORS manual)
───────────────────────────────────────────── */
exports.gerarPixQr = onRequest(
  {
    region: "us-central1",
    cors: [
      "https://ag.assentagencia.com.br",
      "https://assent2-0.vercel.app",
      "http://localhost:5173",
      "http://localhost:3000",
    ],
  },
  async (req, res) => {
    if (req.method !== "POST") { res.status(405).send("Method Not Allowed"); return; }

    const uid = await verificarAuth(req);
    if (!uid) { res.status(401).json({ error: "Não autenticado." }); return; }

    const { tenantUid, valor, descricao } = req.body || {};
    if (!tenantUid || valor == null) {
      res.status(400).json({ error: "tenantUid e valor são obrigatórios." });
      return;
    }

    const configSnap = await db.doc(`users/${tenantUid}/config/geral`).get();
    if (!configSnap.exists) { res.status(404).json({ error: "Configuração não encontrada." }); return; }

    const mpConfig = configSnap.data()?.pagamentos?.mercadopago;
    if (!mpConfig?.ativo)        { res.status(400).json({ error: "Pagamentos PIX não ativados." }); return; }
    if (!mpConfig?.accessToken)  { res.status(400).json({ error: "Access Token não configurado." }); return; }

    const token          = mpConfig.accessToken;
    const idempotencyKey = `assent-${tenantUid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    let mpData;
    try {
      const mpRes = await fetch("https://api.mercadopago.com/v1/payments", {
        method:  "POST",
        headers: {
          "Authorization":     `Bearer ${token}`,
          "Content-Type":      "application/json",
          "X-Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          transaction_amount: parseFloat(Number(valor).toFixed(2)),
          description:        descricao || "Venda PDV ASSENT",
          payment_method_id:  "pix",
          payer: { email: "pagador@assent.com.br", first_name: "Cliente", last_name: "ASSENT" },
          notification_url:   WEBHOOK_URL,
        }),
      });
      mpData = await mpRes.json();
      if (!mpRes.ok) {
        console.error("[gerarPixQr] Erro MP:", mpData);
        res.status(502).json({ error: mpData?.message || `Erro Mercado Pago ${mpRes.status}` });
        return;
      }
    } catch (err) {
      console.error("[gerarPixQr] Fetch error:", err);
      res.status(502).json({ error: "Falha ao conectar com o Mercado Pago." });
      return;
    }

    const txData = mpData?.point_of_interaction?.transaction_data;
    if (!txData?.qr_code_base64 || !txData?.qr_code) {
      console.error("[gerarPixQr] QR não retornado:", mpData);
      res.status(502).json({ error: "QR Code não retornado. Verifique se PIX está habilitado na conta MP." });
      return;
    }

    await db.doc(`users/${tenantUid}/pagamentosQr/${mpData.id}`).set({
      paymentId:    mpData.id,
      tenantUid,
      valor:        parseFloat(Number(valor).toFixed(2)),
      status:       "pending",
      statusDetail: null,
      descricao:    descricao || "",
      criadoEm:     FieldValue.serverTimestamp(),
      atualizadoEm: FieldValue.serverTimestamp(),
    });

    console.log(`[gerarPixQr] Criado: ${mpData.id} — tenant: ${tenantUid} — R$${valor}`);
    res.status(200).json({
      paymentId:    mpData.id,
      qrCodeBase64: txData.qr_code_base64,
      qrCode:       txData.qr_code,
    });
  }
);

/* ─────────────────────────────────────────────
   FUNÇÃO 6: consultarPagamento  (onRequest — CORS manual)
───────────────────────────────────────────── */
exports.consultarPagamento = onRequest(
  {
    region: "us-central1",
    cors: [
      "https://ag.assentagencia.com.br",
      "https://assent2-0.vercel.app",
      "http://localhost:5173",
      "http://localhost:3000",
    ],
  },
  async (req, res) => {
    if (req.method !== "POST") { res.status(405).send("Method Not Allowed"); return; }

    const uid = await verificarAuth(req);
    if (!uid) { res.status(401).json({ error: "Não autenticado." }); return; }

    const { tenantUid, paymentId } = req.body || {};
    if (!tenantUid || !paymentId) {
      res.status(400).json({ error: "tenantUid e paymentId são obrigatórios." });
      return;
    }

    const configSnap = await db.doc(`users/${tenantUid}/config/geral`).get();
    const token      = configSnap.data()?.pagamentos?.mercadopago?.accessToken;
    if (!token) { res.status(400).json({ error: "Token não configurado." }); return; }

    const mpRes  = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { "Authorization": `Bearer ${token}` },
    });
    const mpData = await mpRes.json();
    const novoStatus = mpData.status || "unknown";

    try {
      await db.doc(`users/${tenantUid}/pagamentosQr/${paymentId}`).update({
        status:       novoStatus,
        statusDetail: mpData.status_detail || null,
        atualizadoEm: FieldValue.serverTimestamp(),
      });
    } catch { /* doc pode não existir ainda */ }

    res.status(200).json({ status: novoStatus, statusDetail: mpData.status_detail || null });
  }
);

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

  // Valida: licença deve estar ativa e ter um plano definido
  // (substitui o campo clienteAG do modelo antigo)
  if (!licenca.ativo) {
    throw new HttpsError("permission-denied", "Licença inativa. Entre em contato com o suporte.");
  }
  if (!licenca.plano) {
    throw new HttpsError("permission-denied", "Licença sem plano configurado.");
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

  // ── Limite dinâmico de usuários extras — lido do plano ativo ───────────
  const [usuariosSnap, licencaParaLimiteSnap] = await Promise.all([
    db.collection(`users/${tenantUid}/usuarios`).get(),
    db.doc(`licencas/${tenantUid}`).get(),
  ]);

  const ativos = usuariosSnap.docs.filter(d => d.data().ativo !== false).length;

  // Lê o limite do subdoc do plano; fallback seguro = 5 (Essencial)
  let limiteLoginsExtras = 5;
  try {
    const planoAtual = licencaParaLimiteSnap.data()?.plano;
    if (planoAtual) {
      const planoSnap = await db.doc(`licencas/${tenantUid}/plano/${planoAtual}`).get();
      if (planoSnap.exists) {
        limiteLoginsExtras = planoSnap.data()?.limites?.loginsExtras ?? 5;
      }
    }
  } catch (err) {
    console.warn(`[criarUsuario] Não foi possível ler limite do plano para ${tenantUid}:`, err.message);
    // Mantém fallback = 5
  }

  if (ativos >= limiteLoginsExtras) {
    throw new HttpsError(
      "resource-exhausted",
      `Limite de ${limiteLoginsExtras} usuários adicionais atingido para o seu plano.`
    );
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
exports.editarUsuario = onCall(ADMIN_CALL_OPTIONS, async (request) => {
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


/* ═══════════════════════════════════════════════════════════════
   PAGAMENTOS PIX — Mercado Pago via Cloud Functions
   O token MP fica SOMENTE no Firestore (server-side).
   O front nunca toca nas credenciais.

   Webhook a registrar no painel MP > Webhooks > Pagamentos:
   https://us-central1-assent-2b945.cloudfunctions.net/mpWebhook

   Regra Firestore necessária (firestore.rules):
   match /users/{tenantUid}/pagamentosQr/{paymentId} {
     allow read: if request.auth != null && request.auth.uid == tenantUid;
     allow write: if false; // só o Admin SDK escreve
   }
═══════════════════════════════════════════════════════════════ */

const WEBHOOK_URL = "https://us-central1-assent-2b945.cloudfunctions.net/mpWebhook";


/** Variação percentual entre dois valores. Retorna null se base for 0. */
function varPct(atual, anterior) {
  if (!anterior || anterior === 0) return null;
  return ((atual - anterior) / anterior) * 100;
}

/** Formata valor em BRL compacto: R$ 1.250,00 */
function brl(v) {
  return Number(v || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
}

/** Salva um insight no Firestore. Não sobrescreve — sempre cria novo doc. */
async function salvar(insightsRef, agora, { tipo, titulo, mensagem, prioridade = "normal" }) {
  await insightsRef.add({
    tipo,
    titulo,
    mensagem,
    prioridade,
    criadoEm: Timestamp.fromDate(agora),
    lida: false,
  });
}

/** Deleta insights com mais de 5 dias. */
async function deletarVelhos(insightsRef, agora) {
  const limite = new Date(agora.getTime() - 5 * 24 * 60 * 60 * 1000);
  const snap = await insightsRef
    .where("criadoEm", "<", Timestamp.fromDate(limite))
    .get();
  if (snap.empty) return;
  const batch = insightsRef.firestore.batch();
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
}

/**
 * Retorna um Set com os tipos de insights gerados nos últimos N dias.
 * Usado para evitar repetições dentro da janela.
 */
async function tiposRecentes(insightsRef, agora, diasAtras = 3) {
  const limite = new Date(agora.getTime() - diasAtras * 24 * 60 * 60 * 1000);
  const snap = await insightsRef
    .where("criadoEm", ">=", Timestamp.fromDate(limite))
    .get();
  return new Set(snap.docs.map((d) => d.data().tipo));
}

// ─── Análise de Vendas ───────────────────────────────────────────────────────

async function analisarVendas(insightsRef, agora, usados, atualSnap, anteriorSnap) {
  const toObj = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const todas_atual    = toObj(atualSnap);
  const todas_anterior = toObj(anteriorSnap);

  const ativas_atual    = todas_atual.filter((v) => v.status !== "cancelado");
  const ativas_anterior = todas_anterior.filter((v) => v.status !== "cancelado");
  const canceladas      = todas_atual.filter((v) => v.status === "cancelado");

  // Sem dados suficientes → não gera nada
  if (ativas_atual.length < 3 && ativas_anterior.length < 3) return;

  const receitaAtual    = ativas_atual.reduce((s, v) => s + (Number(v.total) || 0), 0);
  const receitaAnterior = ativas_anterior.reduce((s, v) => s + (Number(v.total) || 0), 0);

  // ── 1. Variação de faturamento ────────────────────────────────────────────
  if (ativas_atual.length >= 3 && ativas_anterior.length >= 3) {
    const delta = varPct(receitaAtual, receitaAnterior);

    if (delta !== null && delta >= 15 && !usados.has("faturamento_alta")) {
      // Identifica o produto mais responsável pelo crescimento
      const prodMap = {};
      ativas_atual.forEach((v) => {
        (v.itens || []).forEach((item) => {
          const nome = item.nome || item.produto || "Produto";
          prodMap[nome] = (prodMap[nome] || 0) + (Number(item.total) || Number(item.valor) || 0);
        });
      });
      const top = Object.entries(prodMap).sort((a, b) => b[1] - a[1])[0];
      const pctTop = top ? ((top[1] / receitaAtual) * 100).toFixed(0) : null;

      let msg =
        `Este mês você faturou ${delta.toFixed(0)}% a mais do que no mesmo período do mês passado ` +
        `(${brl(receitaAtual)} vs ${brl(receitaAnterior)}).`;

      if (top && pctTop && Number(pctTop) >= 25) {
        msg += ` O produto "${top[0]}" liderou com ${pctTop}% da receita (${brl(top[1])}). ` +
          `Vale reforçar o estoque e aumentar a divulgação desse item.`;
      } else {
        msg += ` O crescimento foi distribuído entre vários produtos — boa diversificação.`;
      }

      await salvar(insightsRef, agora, {
        tipo: "faturamento_alta",
        titulo: `📈 Faturamento subiu ${delta.toFixed(0)}% este mês`,
        mensagem: msg,
        prioridade: "high",
      });
      usados.add("faturamento_alta");
    }

    if (delta !== null && delta <= -15 && !usados.has("faturamento_queda")) {
      const diff = Math.abs(receitaAnterior - receitaAtual);

      // Verifica se a queda é de volume ou de ticket
      const ticketAtual    = ativas_atual.length > 0 ? receitaAtual / ativas_atual.length : 0;
      const ticketAnterior = ativas_anterior.length > 0 ? receitaAnterior / ativas_anterior.length : 0;
      const queda_volume   = ativas_atual.length < ativas_anterior.length;
      const queda_ticket   = ticketAtual < ticketAnterior * 0.85;

      let causa = "";
      if (queda_volume && queda_ticket) {
        causa = " O número de vendas e o ticket médio caíram juntos — vale revisar pricing e ações de captação.";
      } else if (queda_volume) {
        causa = ` O ticket médio está estável, mas você fez ${ativas_anterior.length - ativas_atual.length} venda(s) a menos. Foque em ações de atração de clientes.`;
      } else if (queda_ticket) {
        causa = ` O volume de vendas está parecido, mas o ticket médio caiu ${((1 - ticketAtual / ticketAnterior) * 100).toFixed(0)}%. Verifique se há excesso de descontos ou produtos de maior valor em falta.`;
      }

      await salvar(insightsRef, agora, {
        tipo: "faturamento_queda",
        titulo: `📉 Faturamento ${Math.abs(delta).toFixed(0)}% abaixo do mês passado`,
        mensagem:
          `Este mês o faturamento está ${Math.abs(delta).toFixed(0)}% abaixo do mesmo período do mês passado. ` +
          `São ${brl(diff)} a menos (${brl(receitaAtual)} vs ${brl(receitaAnterior)}).` +
          causa,
        prioridade: "high",
      });
      usados.add("faturamento_queda");
    }
  }

  // ── 2. Produto destaque (só se o módulo tem dados reais) ──────────────────
  if (ativas_atual.length >= 5 && !usados.has("produto_destaque")) {
    const prodMap = {};
    ativas_atual.forEach((v) => {
      (v.itens || []).forEach((item) => {
        const nome = item.nome || item.produto || "Produto";
        const qtd  = Number(item.quantidade) || Number(item.qtd) || 1;
        const tot  = Number(item.total) || Number(item.valor) || 0;
        if (!prodMap[nome]) prodMap[nome] = { qtd: 0, total: 0 };
        prodMap[nome].qtd   += qtd;
        prodMap[nome].total += tot;
      });
    });

    const entries = Object.entries(prodMap).sort((a, b) => b[1].total - a[1].total);
    const top     = entries[0];
    const segundo = entries[1];

    if (top && receitaAtual > 0) {
      const pctProd = ((top[1].total / receitaAtual) * 100).toFixed(0);
      if (Number(pctProd) >= 30) {
        let msg =
          `"${top[0]}" é responsável por ${pctProd}% do faturamento este mês ` +
          `(${brl(top[1].total)} em ${top[1].qtd} unidade${top[1].qtd !== 1 ? "s" : ""}). ` +
          `Mantenha o estoque abastecido e considere ampliar a divulgação.`;

        if (segundo) {
          msg += ` Em segundo lugar, "${segundo[0]}" gerou ${brl(segundo[1].total)}.`;
        }

        await salvar(insightsRef, agora, {
          tipo: "produto_destaque",
          titulo: `🏆 "${top[0]}" lidera o faturamento este mês`,
          mensagem: msg,
        });
        usados.add("produto_destaque");
      }
    }
  }

  // ── 3. Variação de ticket médio ───────────────────────────────────────────
  if (ativas_atual.length >= 3 && ativas_anterior.length >= 3) {
    const ticketAtual    = receitaAtual / ativas_atual.length;
    const ticketAnterior = receitaAnterior / ativas_anterior.length;
    const deltaTicket    = varPct(ticketAtual, ticketAnterior);

    if (deltaTicket !== null && deltaTicket >= 20 && !usados.has("ticket_alta")) {
      await salvar(insightsRef, agora, {
        tipo: "ticket_alta",
        titulo: `💰 Ticket médio subiu ${deltaTicket.toFixed(0)}%`,
        mensagem:
          `O valor médio por venda subiu de ${brl(ticketAnterior)} para ${brl(ticketAtual)} ` +
          `(+${deltaTicket.toFixed(0)}% vs mesmo período do mês passado). ` +
          `Seus clientes estão comprando mais por pedido — bom momento para explorar combos e upsell.`,
      });
      usados.add("ticket_alta");
    }

    if (deltaTicket !== null && deltaTicket <= -20 && !usados.has("ticket_queda")) {
      await salvar(insightsRef, agora, {
        tipo: "ticket_queda",
        titulo: `💸 Ticket médio caindo ${Math.abs(deltaTicket).toFixed(0)}%`,
        mensagem:
          `O valor médio por venda caiu de ${brl(ticketAnterior)} para ${brl(ticketAtual)} ` +
          `(-${Math.abs(deltaTicket).toFixed(0)}% vs mesmo período do mês passado). ` +
          `Verifique se há excesso de descontos aplicados ou se os produtos de maior valor estão em falta no estoque.`,
        prioridade: "high",
      });
      usados.add("ticket_queda");
    }
  }

  // ── 4. Alerta de cancelamentos ────────────────────────────────────────────
  const totalBruto = todas_atual.length;
  if (totalBruto >= 5 && canceladas.length >= 3 && !usados.has("cancelamentos_alerta")) {
    const pctCancel = (canceladas.length / totalBruto) * 100;
    if (pctCancel >= 25) {
      await salvar(insightsRef, agora, {
        tipo: "cancelamentos_alerta",
        titulo: `⚠️ ${pctCancel.toFixed(0)}% das vendas foram canceladas`,
        mensagem:
          `${canceladas.length} de ${totalBruto} vendas deste mês foram canceladas (${pctCancel.toFixed(0)}%). ` +
          `Esse índice está acima do esperado e pode indicar problemas de entrega, estoque, prazo ou satisfação. ` +
          `Analise os cancelamentos no módulo Vendas → aba "Canceladas" para identificar o padrão.`,
        prioridade: "high",
      });
      usados.add("cancelamentos_alerta");
    }
  }
}

// ─── Análise de Matrículas ───────────────────────────────────────────────────

async function analisarMatriculas(insightsRef, agora, usados, atualSnap, anteriorSnap) {
  const toObj = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const ativos_atual    = toObj(atualSnap).filter((a) => a.status !== "inativo" && a.status !== "cancelado");
  const ativos_anterior = toObj(anteriorSnap).filter((a) => a.status !== "inativo" && a.status !== "cancelado");

  // Módulo sem dados suficientes → silêncio total
  if (ativos_atual.length < 2 && ativos_anterior.length < 2) return;

  const delta = varPct(ativos_atual.length, ativos_anterior.length);

  if (delta !== null && delta <= -20 && !usados.has("matriculas_queda")) {
    const diff = ativos_anterior.length - ativos_atual.length;
    await salvar(insightsRef, agora, {
      tipo: "matriculas_queda",
      titulo: `🎓 Matrículas caíram ${Math.abs(delta).toFixed(0)}% este mês`,
      mensagem:
        `Foram ${ativos_atual.length} novas matrículas até agora, contra ${ativos_anterior.length} no mesmo período do mês passado ` +
        `(-${diff} matrícula${diff !== 1 ? "s" : ""}). ` +
        `Considere uma campanha de captação — indicação entre alunos, post nas redes sociais com depoimentos ou desconto para matrículas até o dia X costumam funcionar bem.`,
      prioridade: "high",
    });
    usados.add("matriculas_queda");
  }

  if (delta !== null && delta >= 20 && !usados.has("matriculas_alta")) {
    await salvar(insightsRef, agora, {
      tipo: "matriculas_alta",
      titulo: `🎓 Matrículas cresceram ${delta.toFixed(0)}% este mês`,
      mensagem:
        `Foram ${ativos_atual.length} novas matrículas até agora, contra ${ativos_anterior.length} no mesmo período do mês passado. ` +
        `Boa fase de captação — agora é o momento certo para investir na retenção: ` +
        `acompanhamento próximo, qualidade das aulas e ações que incentivem a renovação no mês seguinte.`,
    });
    usados.add("matriculas_alta");
  }

  // Alerta de evasão (se módulo tem histórico mas quase zerou)
  if (ativos_anterior.length >= 5 && ativos_atual.length === 0 && !usados.has("matriculas_zero")) {
    await salvar(insightsRef, agora, {
      tipo: "matriculas_zero",
      titulo: `🎓 Nenhuma matrícula nova até agora este mês`,
      mensagem:
        `No mesmo período do mês passado você tinha ${ativos_anterior.length} matrícula${ativos_anterior.length !== 1 ? "s" : ""}. ` +
        `Este mês ainda não há nenhuma registrada. Considere acionar os contatos em aberto e divulgar nas redes.`,
      prioridade: "high",
    });
    usados.add("matriculas_zero");
  }
}

// ─── Processamento por tenant ────────────────────────────────────────────────

async function processarTenant(db, tenantUid, agora) {
  const insightsRef = db
    .collection("users")
    .doc(tenantUid)
    .collection("insights");

  // 1. Limpa insights com mais de 5 dias
  await deletarVelhos(insightsRef, agora);

  // 2. Tipos já gerados nos últimos 3 dias (evita repetição)
  const usados = await tiposRecentes(insightsRef, agora, 3);

  // 3. Define intervalos para comparação
  // Comparamos os primeiros N dias deste mês com os primeiros N dias do mês anterior.
  // Isso evita comparações injustas quando estamos no início do mês.
  const diaAtual = agora.getDate();
  if (diaAtual < 4) return; // Muito cedo no mês para gerar insights

  const ano = agora.getFullYear();
  const mes = agora.getMonth(); // 0-indexed

  const inicioAtual    = new Date(ano, mes,     1,        0, 0, 0);
  const fimAtual       = new Date(ano, mes,     diaAtual, 23, 59, 59);
  const inicioAnterior = new Date(ano, mes - 1, 1,        0, 0, 0);
  const fimAnterior    = new Date(ano, mes - 1, diaAtual, 23, 59, 59);

  // 4. Busca dados das duas coleções em paralelo
  const vendasRef = db.collection("users").doc(tenantUid).collection("vendas");
  const alunosRef = db.collection("users").doc(tenantUid).collection("alunos");

  const [vendasAtual, vendasAnterior, alunosAtual, alunosAnterior] = await Promise.all([
    vendasRef
      .where("data", ">=", Timestamp.fromDate(inicioAtual))
      .where("data", "<=", Timestamp.fromDate(fimAtual))
      .get(),
    vendasRef
      .where("data", ">=", Timestamp.fromDate(inicioAnterior))
      .where("data", "<=", Timestamp.fromDate(fimAnterior))
      .get(),
    alunosRef
      .where("criadoEm", ">=", Timestamp.fromDate(inicioAtual))
      .where("criadoEm", "<=", Timestamp.fromDate(fimAtual))
      .get(),
    alunosRef
      .where("criadoEm", ">=", Timestamp.fromDate(inicioAnterior))
      .where("criadoEm", "<=", Timestamp.fromDate(fimAnterior))
      .get(),
  ]);

  // 5. Roda as análises (cada uma guarda no Firestore diretamente)
  await analisarVendas(insightsRef, agora, usados, vendasAtual, vendasAnterior);
  await analisarMatriculas(insightsRef, agora, usados, alunosAtual, alunosAnterior);
}

// ─── Cloud Functions ─────────────────────────────────────────────────────────

/**
 * gerarInsights — roda todo dia às 8h (horário de Brasília).
 * Gera insights de negócio por tenant e salva em users/{uid}/insights.
 */
exports.gerarInsights = onSchedule(
  {
    schedule: "0 11 * * *",     // 11h UTC = 8h BRT (UTC-3)
    timeZone: "America/Sao_Paulo",
    memory: "256MiB",
    timeoutSeconds: 120,
  },
  async () => {
    const db    = getFirestore();
    const agora = new Date();

    const licencasSnap = await db
      .collection("licencas")
      .where("ativo", "==", true)
      .get();

    if (licencasSnap.empty) return;

    await Promise.allSettled(
      licencasSnap.docs.map(async (doc) => {
        try {
          await processarTenant(db, doc.id, agora);
        } catch (err) {
          console.error(`[gerarInsights] Erro no tenant ${doc.id}:`, err.message);
        }
      })
    );

    console.log(`[gerarInsights] Processados ${licencasSnap.size} tenant(s) em ${new Date() - agora}ms`);
  }
);

/**
 * limparInsightsVelhos — roda toda segunda-feira às 3h como segurança extra,
 * caso o gerarInsights diário não tenha limpado algum documento.
 */
exports.limparInsightsVelhos = onSchedule(
  {
    schedule: "0 6 * * 1",      // Toda segunda às 6h UTC (3h BRT)
    timeZone: "America/Sao_Paulo",
    memory: "256MiB",
  },
  async () => {
    const db    = getFirestore();
    const agora = new Date();

    const usersSnap = await db.collection("users").listDocuments();
    await Promise.allSettled(
      usersSnap.map(async (userRef) => {
        try {
          const insightsRef = userRef.collection("insights");
          await deletarVelhos(insightsRef, agora);
        } catch (_) {}
      })
    );
  }
);


/* ═══════════════════════════════════════════════════════════════
   LICENÇAS & PLANOS — Controle de limites e trial
═══════════════════════════════════════════════════════════════ */

/* ─────────────────────────────────────────────
   FUNÇÃO: onVendaCreated
   Dispara quando uma venda é criada.
   Incrementa contagem.vendasMes no plano ativo.
   Rejeita (log) se o limite mensal foi atingido.
───────────────────────────────────────────── */
exports.onVendaCreated = onDocumentCreated(
  "users/{tenantUid}/vendas/{vendaId}",
  async (event) => {
    const { tenantUid } = event.params;

    const licencaRef  = db.doc(`licencas/${tenantUid}`);
    const licencaSnap = await licencaRef.get();

    if (!licencaSnap.exists) {
      console.error(`Licença não encontrada para tenant: ${tenantUid}`);
      return;
    }

    const { plano, ativo } = licencaSnap.data();

    if (!ativo) {
      console.warn(`Licença inativa para tenant: ${tenantUid}`);
      return;
    }

    const planoRef = db.doc(`licencas/${tenantUid}/plano/${plano}`);

    await db.runTransaction(async (tx) => {
      const planoSnap = await tx.get(planoRef);

      if (!planoSnap.exists) {
        console.error(`Subdoc do plano "${plano}" não encontrado para tenant: ${tenantUid}`);
        return;
      }

      const { contagem, limites } = planoSnap.data();
      const vendasMes    = contagem?.vendasMes ?? 0;
      const limiteVendas = limites?.vendasMes  ?? 500; // trial tem o mesmo limite do essencial

      if (vendasMes >= limiteVendas) {
        console.warn(`Limite de vendas atingido para tenant: ${tenantUid} (${vendasMes}/${limiteVendas})`);
        return;
      }

      tx.update(planoRef, {
        "contagem.vendasMes": FieldValue.increment(1),
      });
    });
  }
);

/* ─────────────────────────────────────────────
   FUNÇÃO: resetContagemMensal
   Roda todo dia 1 às 00:00 (horário de Brasília).
   Zera contagem.vendasMes em todos os planos ativos.
───────────────────────────────────────────── */
exports.resetContagemMensal = onSchedule(
  {
    schedule: "0 0 1 * *",
    timeZone: "America/Sao_Paulo",
  },
  async () => {
    const snapshot = await db
      .collectionGroup("plano")
      .where("ativo", "==", true)
      .get();

    if (snapshot.empty) {
      console.log("Nenhum plano ativo encontrado para reset.");
      return;
    }

    const BATCH_LIMIT = 500;
    let batch = db.batch();
    let count = 0;

    for (const doc of snapshot.docs) {
      batch.update(doc.ref, {
        "contagem.vendasMes": 0,
        "contagem.resetAt":   Timestamp.now(),
      });
      count++;

      if (count % BATCH_LIMIT === 0) {
        await batch.commit();
        batch = db.batch();
      }
    }

    if (count % BATCH_LIMIT !== 0) {
      await batch.commit();
    }

    console.log(`Reset mensal aplicado em ${snapshot.size} planos.`);
  }
);

/* ─────────────────────────────────────────────
   FUNÇÃO: onTrialExpiry
   Roda todo dia às 03:00 (horário de Brasília).
   Marca ativo: false em licenças trial vencidas.
───────────────────────────────────────────── */
exports.onTrialExpiry = onSchedule(
  {
    schedule: "0 6 * * *",       // 6h UTC = 3h BRT (UTC-3)
    timeZone: "America/Sao_Paulo",
  },
  async () => {
    const agora = Timestamp.now();

    const snapshot = await db
      .collection("licencas")
      .where("plano",       "==", "trial")
      .where("ativo",       "==", true)
      .where("trialExpira", "<=", agora)
      .get();

    if (snapshot.empty) {
      console.log("Nenhum trial vencido encontrado.");
      return;
    }

    const BATCH_LIMIT = 500;
    let batch = db.batch();
    let count = 0;

    for (const doc of snapshot.docs) {
      batch.update(doc.ref, { ativo: false });
      count++;

      if (count % BATCH_LIMIT === 0) {
        await batch.commit();
        batch = db.batch();
      }
    }

    if (count % BATCH_LIMIT !== 0) {
      await batch.commit();
    }

    console.log(`${snapshot.size} licenças trial expiradas desativadas.`);
  }
);


/* ═══════════════════════════════════════════════════════════════
   STRIPE WEBHOOK — Ativação automática de licença após pagamento
   
   Eventos tratados:
     checkout.session.completed    → pagamento direto OU início de trial
     invoice.payment_succeeded     → trial convertido em pago
     customer.subscription.deleted → trial expirou / cancelamento
   
   Configurar no Stripe Dashboard → Developers → Webhooks:
     Endpoint: https://us-central1-assent-2b945.cloudfunctions.net/stripeWebhook
     Events:   checkout.session.completed
               invoice.payment_succeeded
               customer.subscription.deleted
   
   Secrets a criar (firebase functions:secrets:set):
     STRIPE_SECRET_KEY      → sk_live_...
     STRIPE_WEBHOOK_SECRET  → whsec_...
     MAIL_USER              → assent.ofc@gmail.com
     MAIL_PASS              → senha-de-app-gmail
═══════════════════════════════════════════════════════════════ */

/* ─── helpers internos do webhook ─── */

async function _getOrCreateAuthUser(email) {
  try {
    const u = await admin.auth().getUserByEmail(email);
    return { uid: u.uid, isNew: false };
  } catch (err) {
    if (err.code !== "auth/user-not-found") throw err;
    const u = await admin.auth().createUser({
      email,
      emailVerified: false,
      displayName:   email.split("@")[0],
    });
    return { uid: u.uid, isNew: true };
  }
}

async function _setLicenca(uid, plano, rootData, planoData) {
  const ts = FieldValue.serverTimestamp();

  // Root: licencas/{uid}
  await db.collection("licencas").doc(uid).set(
    { ...rootData, atualizadoEm: ts },
    { merge: true }
  );

  // Subcollection: licencas/{uid}/plano/{plano}
  if (planoData) {
    await db.collection("licencas").doc(uid)
      .collection("plano").doc(plano)
      .set({ ...planoData, atualizadoEm: ts }, { merge: true });
  }
}

async function _getUidByStripeCustomer(customerId) {
  const snap = await db.collectionGroup("plano")
    .where("stripeCustomerId", "==", customerId)
    .limit(1)
    .get();
  if (snap.empty) return null;
  // path: licencas/{uid}/plano/{plano}
  return { uid: snap.docs[0].ref.parent.parent.id, plano: snap.docs[0].id };
}

function _makeMailer(mailUser, mailPass) {
  return nodemailer.createTransport({
    service: "gmail",
    auth: { user: mailUser, pass: mailPass },
  });
}

async function _sendWelcomeEmail({ mailUser, mailPass, email, resetLink, plano, isTrial }) {
  const label = { essencial: "Essencial", profissional: "Profissional", trial: "Essencial" }[plano] ?? plano;
  const trialBlurb = isTrial
    ? `<p style="color:#d4af37;font-size:13px">Trial de <strong>7 dias</strong> ativo. Nenhuma cobrança agora.</p>`
    : "";
  await _makeMailer(mailUser, mailPass).sendMail({
    from:    `"ASSENT Gestão" <${mailUser}>`,
    to:      email,
    subject: isTrial ? "Seu trial de 7 dias no ASSENT Gestão começou ✦" : "Seu acesso ao ASSENT Gestão está pronto ✦",
    html: `
      <div style="font-family:Inter,sans-serif;background:#070707;color:#fff;padding:40px;border-radius:12px;max-width:520px;margin:auto">
        <div style="font-size:22px;font-weight:700;margin-bottom:8px;color:#d4af37">ASSENT Gestão</div>
        <p style="color:#aaa;margin-bottom:12px">Plano <strong style="color:#fff">${label}</strong> ativado.</p>
        ${trialBlurb}
        <p style="color:#ccc;line-height:1.6">Crie sua senha para acessar o sistema:</p>
        <a href="${resetLink}" style="display:inline-block;margin-top:24px;padding:14px 28px;background:linear-gradient(135deg,#f4d77a,#d4af37,#a47d1f);color:#1a1100;font-weight:700;border-radius:8px;text-decoration:none;font-size:14px">
          Criar minha senha →
        </a>
        <p style="color:#555;font-size:12px;margin-top:32px">
          Link válido por 1 hora. Se expirar, use "Esqueci minha senha".<br/>
          Dúvidas? <a href="mailto:assent.ofc@gmail.com" style="color:#d4af37">assent.ofc@gmail.com</a>
        </p>
      </div>`,
  });
}

async function _sendTrialExpiredEmail({ mailUser, mailPass, email }) {
  await _makeMailer(mailUser, mailPass).sendMail({
    from:    `"ASSENT Gestão" <${mailUser}>`,
    to:      email,
    subject: "Seu trial ASSENT Gestão expirou",
    html: `
      <div style="font-family:Inter,sans-serif;background:#070707;color:#fff;padding:40px;border-radius:12px;max-width:520px;margin:auto">
        <div style="font-size:22px;font-weight:700;margin-bottom:8px;color:#d4af37">ASSENT Gestão</div>
        <p style="color:#aaa">Seu período de trial encerrou e o acesso foi pausado.</p>
        <a href="https://assentagencia.com.br/#planos" style="display:inline-block;margin-top:24px;padding:14px 28px;background:linear-gradient(135deg,#f4d77a,#d4af37,#a47d1f);color:#1a1100;font-weight:700;border-radius:8px;text-decoration:none;font-size:14px">
          Ver planos →
        </a>
        <p style="color:#555;font-size:12px;margin-top:32px">
          Dúvidas? <a href="mailto:assent.ofc@gmail.com" style="color:#d4af37">assent.ofc@gmail.com</a>
        </p>
      </div>`,
  });
}

/* ─── stripeWebhook ─── */
exports.stripeWebhook = onRequest(
  {
    region:  "us-central1",
    secrets: [STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_TEST_SECRET_KEY, STRIPE_TEST_WEBHOOK, MAIL_USER, MAIL_PASS],
  },
  async (req, res) => {
    if (req.method !== "POST") return res.status(405).end();

    // rawBody obrigatório para verificação de assinatura Stripe
    const body = req.rawBody || Buffer.from(JSON.stringify(req.body));

    // 1. Verificar assinatura — tenta live primeiro, depois test
    const sig = req.headers["stripe-signature"];
    let event;
    let isTestMode = false;

    try {
      const s = Stripe(STRIPE_SECRET_KEY.value(), { apiVersion: "2024-04-10" });
      event = s.webhooks.constructEvent(body, sig, STRIPE_WEBHOOK_SECRET.value());
    } catch (_) {
      try {
        const s = Stripe(STRIPE_TEST_SECRET_KEY.value(), { apiVersion: "2024-04-10" });
        event = s.webhooks.constructEvent(body, sig, STRIPE_TEST_WEBHOOK.value());
        isTestMode = true;
      } catch (err) {
        console.error("[stripeWebhook] Assinatura invalida:", err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
      }
    }

    const stripe = Stripe(
      isTestMode ? STRIPE_TEST_SECRET_KEY.value() : STRIPE_SECRET_KEY.value(),
      { apiVersion: "2024-04-10" }
    );
    console.log(`[stripeWebhook] Modo: ${isTestMode ? "TESTE" : "PRODUCAO"}`);

    const mailUser = MAIL_USER.value();
    const mailPass = MAIL_PASS.value();

    /* ── checkout.session.completed ── */
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const email   = session.customer_details?.email;
      const plano   = session.metadata?.plano;    // "essencial" | "profissional"
      const periodo = session.metadata?.periodo;  // "mensal" | "anual"

      if (!email || !plano) {
        console.error("[stripeWebhook] Metadata ausente:", session.id, { email, plano });
        return res.status(200).json({ received: true, warning: "metadata_missing" });
      }

      try {
        const { uid, isNew } = await _getOrCreateAuthUser(email);

        // Detecta trial
        let isTrial     = false;
        let planoRaiz   = plano;
        let trialExpira = null;

        if (session.mode === "subscription" && session.subscription) {
          const sub = await stripe.subscriptions.retrieve(session.subscription);
          if (sub.status === "trialing") {
            isTrial     = true;
            planoRaiz   = "trial";  // onTrialExpiry usa esse valor para query
            trialExpira = FieldValue.serverTimestamp(); // veja abaixo — usamos Date
          }
        }

        // Root doc
        const rootData = {
          plano:            planoRaiz,
          ativo:            true,
          email,
          stripeCustomerId: session.customer ?? null,
        };
        if (isTrial) {
          // trialExpira = agora + 7 dias (Timestamp compatível com onTrialExpiry)
          const expira = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
          rootData.trialExpira = Timestamp.fromDate(expira);
        }

        // Subdoc: se trial → plano/trial ; se pago direto → plano/essencial ou /profissional
        const subdocPlano = planoRaiz; // "trial" | "essencial" | "profissional"
        const limites     = LIMITES_PLANO[plano] ?? LIMITES_PLANO.essencial;

        // dataVencimento vem do current_period_end da subscription
        let dataVencimento = null;
        let dataInicio     = null;
        if (session.mode === "subscription" && session.subscription) {
          try {
            const subData = await stripe.subscriptions.retrieve(session.subscription);
            dataInicio     = subData.current_period_start
              ? Timestamp.fromDate(new Date(subData.current_period_start * 1000)) : null;
            dataVencimento = subData.current_period_end
              ? Timestamp.fromDate(new Date(subData.current_period_end  * 1000)) : null;
          } catch (_) {}
        }
        if (!dataVencimento && isTrial) {
          dataVencimento = Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
        }

        await _setLicenca(uid, subdocPlano, rootData, {
          ativo:            true,
          status:           isTrial ? "trial" : "ativo",
          slug:             subdocPlano,
          periodo,
          email,
          stripeCustomerId: session.customer ?? null,
          stripeSessionId:  session.id,
          limites,
          features:         FEATURES_PLANO[plano] ?? FEATURES_PLANO.essencial,
          contagem:         { vendasMes: 0 },
          dataInicio,
          dataVencimento,
          ativadoEm:        FieldValue.serverTimestamp(),
        });

        console.log(`[stripeWebhook] Licenca ativada — licencas/${uid}/plano/${subdocPlano} | trial:${isTrial}`);

        // E-mail só para usuários novos
        if (isNew) {
          try {
            const resetLink = await admin.auth().generatePasswordResetLink(email, {
              url: "https://ag.assentagencia.com.br",
            });
            await _sendWelcomeEmail({ mailUser, mailPass, email, resetLink, plano, isTrial });
            console.log("[stripeWebhook] E-mail enviado:", email);
          } catch (mailErr) {
            console.error("[stripeWebhook] Falha e-mail (licenca OK):", mailErr.message);
          }
        }

        return res.status(200).json({ received: true, uid, plano: subdocPlano });

      } catch (err) {
        console.error("[stripeWebhook] Erro checkout.session.completed:", err);
        return res.status(500).send("Internal Server Error");
      }
    }

    /* ── invoice.payment_succeeded — trial convertido em pago ── */
    if (event.type === "invoice.payment_succeeded") {
      const invoice    = event.data.object;

      // Ignora a invoice de R$0 gerada no início do trial
      if (!invoice.amount_paid || invoice.amount_paid === 0) {
        return res.status(200).json({ received: true, skipped: "zero_invoice" });
      }

      const customerId = invoice.customer;
      try {
        const result = await _getUidByStripeCustomer(customerId);
        if (!result) {
          console.error("[stripeWebhook] UID nao encontrado para customer:", customerId);
          return res.status(200).json({ received: true, warning: "uid_not_found" });
        }

        const { uid } = result;

        // Descobre o plano real (vem do metadata da subscription ou da invoice)
        const subId  = invoice.subscription;
        const sub    = subId ? await stripe.subscriptions.retrieve(subId) : null;
        const plano  = sub?.metadata?.plano ?? invoice.metadata?.plano ?? "essencial";
        const periodo = sub?.metadata?.periodo ?? invoice.metadata?.periodo ?? "mensal";
        const limites = LIMITES_PLANO[plano] ?? LIMITES_PLANO.essencial;

        // Atualiza root — remove trial, seta plano real
        await db.collection("licencas").doc(uid).set({
          plano,
          ativo:        true,
          atualizadoEm: FieldValue.serverTimestamp(),
          trialExpira:  FieldValue.delete(),
        }, { merge: true });

        // Cria/atualiza subdoc do plano pago
        await db.collection("licencas").doc(uid)
          .collection("plano").doc(plano)
          .set({
            ativo:        true,
            status:       "ativo",
            periodo,
            limites,
            contagem:     { vendasMes: 0 },
            atualizadoEm: FieldValue.serverTimestamp(),
          }, { merge: true });

        // Desativa subdoc trial se existia
        const trialRef = db.collection("licencas").doc(uid).collection("plano").doc("trial");
        const trialSnap = await trialRef.get();
        if (trialSnap.exists) {
          await trialRef.update({ ativo: false, atualizadoEm: FieldValue.serverTimestamp() });
        }

        console.log(`[stripeWebhook] Trial convertido — licencas/${uid}/plano/${plano}`);
        return res.status(200).json({ received: true, uid, plano });

      } catch (err) {
        console.error("[stripeWebhook] Erro invoice.payment_succeeded:", err);
        return res.status(500).send("Internal Server Error");
      }
    }

    /* ── customer.subscription.deleted — expirou ou cancelou ── */
    if (event.type === "customer.subscription.deleted") {
      const sub        = event.data.object;
      const customerId = sub.customer;

      try {
        const result = await _getUidByStripeCustomer(customerId);
        if (!result) {
          console.error("[stripeWebhook] UID nao encontrado para customer:", customerId);
          return res.status(200).json({ received: true, warning: "uid_not_found" });
        }

        const { uid, plano } = result;

        // Busca email antes de revogar
        const rootSnap = await db.collection("licencas").doc(uid).get();
        const email    = rootSnap.data()?.email;

        // Revoga root e subdoc
        await db.collection("licencas").doc(uid).set({
          ativo:        false,
          atualizadoEm: FieldValue.serverTimestamp(),
        }, { merge: true });

        await db.collection("licencas").doc(uid)
          .collection("plano").doc(plano)
          .set({
            ativo:        false,
            status:       "cancelado",
            atualizadoEm: FieldValue.serverTimestamp(),
          }, { merge: true });

        console.log(`[stripeWebhook] Acesso revogado — licencas/${uid}/plano/${plano}`);

        if (email) {
          try {
            await _sendTrialExpiredEmail({ mailUser, mailPass, email });
          } catch (mailErr) {
            console.error("[stripeWebhook] Falha e-mail expiracao:", mailErr.message);
          }
        }

        return res.status(200).json({ received: true, uid, plano, status: "cancelado" });

      } catch (err) {
        console.error("[stripeWebhook] Erro customer.subscription.deleted:", err);
        return res.status(500).send("Internal Server Error");
      }
    }

    // Evento nao tratado
    return res.status(200).json({ received: true });
  }
);


/* ═══════════════════════════════════════════════════════════════
   FUNÇÃO: atualizarPlano
   Usada pelo painel admin para:
     - changePlan      → muda plano do membro
     - updateVencimento → atualiza dataVencimento no subdoc
═══════════════════════════════════════════════════════════════ */
exports.atualizarPlano = onCall(ADMIN_CALL_OPTIONS, async (request) => {
  await verificarAdmin(request.auth?.uid);

  const { targetUid, action, newSlug, newDataVencimento } = request.data;

  if (!targetUid) throw new HttpsError("invalid-argument", "targetUid obrigatório.");

  const licRootRef = db.collection("licencas").doc(targetUid);
  const licRootSnap = await licRootRef.get();
  if (!licRootSnap.exists) throw new HttpsError("not-found", "Licença não encontrada.");

  const ts = FieldValue.serverTimestamp();

  /* ── changePlan ── */
  if (action === "changePlan") {
    const PLANOS_VALIDOS = ["essencial", "profissional", "trial"];
    if (!newSlug || !PLANOS_VALIDOS.includes(newSlug)) {
      throw new HttpsError("invalid-argument", "Plano inválido.");
    }

    const currentSlug = licRootSnap.data()?.plano;
    const limites     = LIMITES_PLANO[newSlug] ?? LIMITES_PLANO.essencial;

    // Desativa subdoc antigo
    if (currentSlug && currentSlug !== newSlug) {
      await db.collection("licencas").doc(targetUid)
        .collection("plano").doc(currentSlug)
        .set({ ativo: false, atualizadoEm: ts }, { merge: true });
    }

    // Cria/ativa subdoc novo
    await db.collection("licencas").doc(targetUid)
      .collection("plano").doc(newSlug)
      .set({
        ativo:        true,
        status:       "ativo",
        slug:         newSlug,
        limites,
        features:     FEATURES_PLANO[newSlug] ?? FEATURES_PLANO.essencial,
        atualizadoEm: ts,
      }, { merge: true });

    // Atualiza root
    await licRootRef.set({
      plano:        newSlug,
      ativo:        true,
      atualizadoEm: ts,
    }, { merge: true });

    return { ok: true, plano: newSlug };
  }

  /* ── updateVencimento ── */
  if (action === "updateVencimento") {
    if (!newDataVencimento) throw new HttpsError("invalid-argument", "newDataVencimento obrigatório.");

    const currentSlug = licRootSnap.data()?.plano;
    if (!currentSlug) throw new HttpsError("failed-precondition", "Membro sem plano definido.");

    const dataVencimento = Timestamp.fromDate(new Date(newDataVencimento));

    await db.collection("licencas").doc(targetUid)
      .collection("plano").doc(currentSlug)
      .set({ dataVencimento, atualizadoEm: ts }, { merge: true });

    return { ok: true, dataVencimento: newDataVencimento };
  }

  throw new HttpsError("invalid-argument", `Action desconhecida: ${action}`);
});

/* ─── Exporta funções de notificacoes ─── */
module.exports = {
  ...module.exports,
  ...notificacoesFunctions,
};
