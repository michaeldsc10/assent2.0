/* ═══════════════════════════════════════════════════
   ASSENT v2.0 — functions/index.js
   Cloud Functions com validação de cargo no servidor
   + App Check obrigatório (enforceAppCheck)
   + CORS restrito ao domínio da Vercel
   ═══════════════════════════════════════════════════ */
const { onSchedule }              = require("firebase-functions/v2/scheduler");
const { onCall, onRequest,
        HttpsError }              = require("firebase-functions/v2/https");
const { getFirestore,
        Timestamp, FieldValue }   = require("firebase-admin/firestore");
const admin                       = require("firebase-admin");

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

/* ─────────────────────────────────────────────
   FUNÇÃO 4: gerarPixQr
   Cria pagamento PIX no Mercado Pago e salva doc
   no Firestore. O PDV escuta via onSnapshot.
───────────────────────────────────────────── */
exports.gerarPixQr = onCall(CALL_OPTIONS, async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) {
    throw new HttpsError("unauthenticated", "Usuário não autenticado.");
  }

  const { tenantUid, valor, descricao } = request.data;

  if (!tenantUid || valor == null) {
    throw new HttpsError("invalid-argument", "tenantUid e valor são obrigatórios.");
  }

  /* Lê o token do Firestore — nunca exposto ao client */
  const configSnap = await db.doc(`users/${tenantUid}/config/geral`).get();

  if (!configSnap.exists) {
    throw new HttpsError("not-found", "Configuração não encontrada.");
  }

  const mpConfig = configSnap.data()?.pagamentos?.mercadopago;

  if (!mpConfig?.ativo) {
    throw new HttpsError("failed-precondition", "Pagamentos PIX não estão ativados nesta conta.");
  }
  if (!mpConfig?.accessToken) {
    throw new HttpsError("failed-precondition", "Access Token não configurado. Vá em Configurações → Pagamentos Online.");
  }

  const token          = mpConfig.accessToken;
  const idempotencyKey = `assent-${tenantUid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  /* Cria o pagamento no Mercado Pago */
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
      console.error("[gerarPixQr] Erro Mercado Pago:", mpData);
      throw new HttpsError("internal", mpData?.message || `Erro Mercado Pago ${mpRes.status}`);
    }
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    console.error("[gerarPixQr] Fetch error:", err);
    throw new HttpsError("internal", "Falha ao conectar com o Mercado Pago.");
  }

  const txData = mpData?.point_of_interaction?.transaction_data;
  if (!txData?.qr_code_base64 || !txData?.qr_code) {
    console.error("[gerarPixQr] QR não retornado:", mpData);
    throw new HttpsError("internal", "QR Code não retornado. Verifique se PIX está habilitado na conta MP.");
  }

  /* Salva referência no Firestore — PDV escuta via onSnapshot */
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

  return {
    paymentId:    mpData.id,
    qrCodeBase64: txData.qr_code_base64,
    qrCode:       txData.qr_code,
  };
});

/* ─────────────────────────────────────────────
   FUNÇÃO 5: mpWebhook
   Recebida pelo Mercado Pago quando o pagamento
   muda de status. Atualiza Firestore → PDV reage
   via onSnapshot sem polling no cliente.

   ⚠️ Pública intencionalmente — o MP chama de fora.
   A validação é feita pelo paymentId no Firestore.
───────────────────────────────────────────── */
exports.mpWebhook = onRequest(
  { region: "us-central1", cors: false },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
      return;
    }

    const { type, data } = req.body || {};

    if (type !== "payment" || !data?.id) {
      res.status(200).send("OK");
      return;
    }

    const paymentId = Number(data.id);

    try {
      /* Localiza o tenant dono deste pagamento */
      const snap = await db
        .collectionGroup("pagamentosQr")
        .where("paymentId", "==", paymentId)
        .limit(1)
        .get();

      if (snap.empty) {
        res.status(200).send("OK");
        return;
      }

      const payDoc    = snap.docs[0];
      const { tenantUid } = payDoc.data();

      /* Lê token do tenant */
      const configSnap = await db.doc(`users/${tenantUid}/config/geral`).get();
      const token      = configSnap.data()?.pagamentos?.mercadopago?.accessToken;

      if (!token) {
        console.error(`[mpWebhook] Token ausente para tenant ${tenantUid}`);
        res.status(200).send("OK");
        return;
      }

      /* Confirma status diretamente na API do MP */
      const mpRes  = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: { "Authorization": `Bearer ${token}` },
      });
      const mpData = await mpRes.json();

      const novoStatus = mpData.status || "unknown";

      /* Atualiza Firestore → onSnapshot do PDV reage */
      await payDoc.ref.update({
        status:       novoStatus,
        statusDetail: mpData.status_detail || null,
        atualizadoEm: FieldValue.serverTimestamp(),
      });

      console.log(`[mpWebhook] ${paymentId} → ${novoStatus} (tenant: ${tenantUid})`);
      res.status(200).send("OK");

    } catch (err) {
      console.error("[mpWebhook] Erro:", err);
      res.status(200).send("OK"); // sempre 200 pro MP não reenviar em loop
    }
  }
);

/* ─────────────────────────────────────────────
   FUNÇÃO 6: consultarPagamento
   Fallback de polling caso o webhook falhe.
   O ModalQrPix chama a cada 8s como segurança.
───────────────────────────────────────────── */
exports.consultarPagamento = onCall(CALL_OPTIONS, async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) {
    throw new HttpsError("unauthenticated", "Usuário não autenticado.");
  }

  const { tenantUid, paymentId } = request.data;

  if (!tenantUid || !paymentId) {
    throw new HttpsError("invalid-argument", "tenantUid e paymentId são obrigatórios.");
  }

  const configSnap = await db.doc(`users/${tenantUid}/config/geral`).get();
  const token      = configSnap.data()?.pagamentos?.mercadopago?.accessToken;

  if (!token) {
    throw new HttpsError("failed-precondition", "Token não configurado.");
  }

  const mpRes  = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { "Authorization": `Bearer ${token}` },
  });
  const mpData = await mpRes.json();

  const novoStatus = mpData.status || "unknown";

  /* Sincroniza Firestore também — mantém onSnapshot atualizado */
  try {
    await db.doc(`users/${tenantUid}/pagamentosQr/${paymentId}`).update({
      status:       novoStatus,
      statusDetail: mpData.status_detail || null,
      atualizadoEm: FieldValue.serverTimestamp(),
    });
  } catch { /* doc pode não existir ainda — sem problema */ }

  return { status: novoStatus, statusDetail: mpData.status_detail || null };
});

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

