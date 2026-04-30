import { useState, useEffect } from "react";
import {
  doc,
  collection,
  onSnapshot,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../lib/firebase";

// ─── Configuração padrão do Radar ────────────────────────────────────────────
// Salva em dadosCRM/{empresaId} → radar
// Sobrescrito pelo usuário via Configurações → Configurar Radar.
export const RADAR_PADRAO = {
  diasMedio: 15,   // dias ausente → risco médio  (sem histórico de frequência)
  diasAlto:  30,   // dias ausente → risco alto   (sem histórico de frequência)
  multMedio: 1.5,  // mult. da freq. média → risco médio
  multAlto:  2.5,  // mult. da freq. média → risco alto
};

// ─── Helper: converte Timestamp do Firestore ou string para Date ──────────────
function toDate(val) {
  if (!val) return new Date(0);
  if (val?.toDate) return val.toDate();
  return new Date(val);
}

// ─── Helper: compara nome do cliente com tolerância a nomes parciais ──────────
function matchNomeCliente(vendaCliente = "", clienteNome = "") {
  const a = (vendaCliente || "").trim().toLowerCase();
  const b = (clienteNome || "").trim().toLowerCase();
  if (!a || !b) return false;
  return a === b || b.startsWith(a) || a.startsWith(b);
}

// ─── Gera chave segura para ID de documento no Firestore ─────────────────────
function chaveCliente(clienteId, clienteNome) {
  if (clienteId) return clienteId;
  return (clienteNome || "desconhecido")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "_")
    .slice(0, 80);
}

// ─── Ignorar cliente ──────────────────────────────────────────────────────────
// Caminho: dadosCRM/{empresaId}/ignore/{chaveCliente}
export async function ignorarCliente(empresaId, cliente) {
  const chave = chaveCliente(cliente.id, cliente.nome);
  await setDoc(doc(db, "dadosCRM", empresaId, "ignore", chave), {
    clienteId:  cliente.id       || null,
    nome:       cliente.nome     || "Desconhecido",
    telefone:   cliente.telefone || null,
    ignoradoEm: serverTimestamp(),
  });
}

// ─── Reativar cliente ignorado ────────────────────────────────────────────────
export async function reativarCliente(empresaId, clienteIgnorado) {
  const chave = clienteIgnorado._docId ||
    chaveCliente(clienteIgnorado.clienteId, clienteIgnorado.nome);
  await deleteDoc(doc(db, "dadosCRM", empresaId, "ignore", chave));
}

// ─── Score de churn ───────────────────────────────────────────────────────────
function calcularScoreChurn(clientes = [], vendas = [], radar = RADAR_PADRAO) {
  const { diasMedio, diasAlto, multMedio, multAlto } = { ...RADAR_PADRAO, ...radar };
  const hoje = new Date();

  return clientes.map((cliente) => {
    const vendasCliente = vendas
      .filter((v) => matchNomeCliente(v.cliente, cliente.nome))
      .map((v) => ({ ...v, _data: toDate(v.data) }))
      .sort((a, b) => a._data - b._data);

    if (vendasCliente.length === 0) {
      return { ...cliente, _semVendas: true, risco: "indefinido" };
    }

    const ultima = vendasCliente[vendasCliente.length - 1];
    const diasAusente = Math.floor((hoje - ultima._data) / 86400000);

    let frequenciaMedia = null;
    if (vendasCliente.length >= 2) {
      const intervalos = [];
      for (let i = 1; i < vendasCliente.length; i++) {
        intervalos.push(
          (vendasCliente[i]._data - vendasCliente[i - 1]._data) / 86400000
        );
      }
      frequenciaMedia = Math.round(
        intervalos.reduce((a, b) => a + b, 0) / intervalos.length
      );
    }

    const totalGasto = vendasCliente.reduce(
      (acc, v) => acc + (v.total ?? v.custoTotal ?? 0), 0
    );
    const ticketMedio = Math.round(totalGasto / vendasCliente.length);

    const contagem = {};
    vendasCliente.forEach((v) =>
      (v.itens || []).forEach((i) => {
        const nomeProduto = i.nome || i.produto || "Desconhecido";
        contagem[nomeProduto] = (contagem[nomeProduto] || 0) + 1;
      })
    );
    const [produtoFavorito] =
      Object.entries(contagem).sort((a, b) => b[1] - a[1])[0] || [];

    const mult = frequenciaMedia ? diasAusente / frequenciaMedia : null;
    let risco = "baixo";
    if (mult !== null) {
      if (mult > multAlto)  risco = "alto";
      else if (mult > multMedio) risco = "medio";
    } else {
      if (diasAusente > diasAlto)  risco = "alto";
      else if (diasAusente > diasMedio) risco = "medio";
    }

    return {
      ...cliente,
      diasAusente,
      frequenciaMedia,
      ticketMedio,
      produtoFavorito: produtoFavorito || null,
      totalCompras: vendasCliente.length,
      ultimaCompra: ultima.data,
      risco,
      multiplicador: mult ? parseFloat(mult.toFixed(1)) : null,
    };
  });
}

// ─── Gerador de insights ──────────────────────────────────────────────────────
function gerarInsights(clientesComScore, vendas = [], servicos = [], ignorados = []) {
  const nomesIgnorados = new Set(
    ignorados.map((ig) => (ig.nome || "").trim().toLowerCase())
  );

  const insights = [];

  clientesComScore.forEach((c) => {
    if (c._semVendas) return;
    if (nomesIgnorados.has((c.nome || "").trim().toLowerCase())) return;

    if (c.risco === "alto" || c.risco === "medio") {
      insights.push({
        id: `risco-${c.nome}`,
        tipo: "risco",
        prioridade: c.risco === "alto" ? 1 : 2,
        clienteId: c.id || null,
        cliente: c.nome,
        telefone: c.telefone,
        diasAusente: c.diasAusente,
        frequenciaMedia: c.frequenciaMedia,
        produtoFavorito: c.produtoFavorito,
        ticketMedio: c.ticketMedio,
        multiplicador: c.multiplicador,
        descricao: c.frequenciaMedia
          ? `Frequência média é ${c.frequenciaMedia} dias — está ${c.diasAusente} dias sem aparecer (${c.multiplicador}× acima do normal).`
          : `${c.diasAusente} dias sem aparecer. Último serviço: ${c.produtoFavorito || "não identificado"}.`,
      });
    }

    const comprados = new Set(
      vendas
        .filter((v) => matchNomeCliente(v.cliente, c.nome))
        .flatMap((v) => (v.itens || []).map((i) => i.nome || i.produto))
    );

    const catFav = (() => {
      const cc = {};
      vendas
        .filter((v) => matchNomeCliente(v.cliente, c.nome))
        .forEach((v) =>
          (v.itens || []).forEach((item) => {
            const nomeProd = item.nome || item.produto;
            const srv = servicos.find((s) => s.nome === nomeProd);
            if (srv?.categoria) cc[srv.categoria] = (cc[srv.categoria] || 0) + 1;
          })
        );
      return Object.entries(cc).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
    })();

    const naoComprado = servicos.find(
      (s) => !comprados.has(s.nome) && s.categoria === catFav
    );
    if (naoComprado && c.risco === "baixo" && catFav) {
      insights.push({
        id: `upsell-${c.nome}`,
        tipo: "oportunidade",
        prioridade: 3,
        clienteId: c.id || null,
        cliente: c.nome,
        telefone: c.telefone,
        servico: naoComprado.nome,
        preco: naoComprado.preco,
        ticketMedio: c.ticketMedio,
        descricao: `Sempre contrata ${catFav}, mas nunca experimentou "${naoComprado.nome}". Potencial: +R$ ${naoComprado.preco}.`,
      });
    }
  });

  return insights.sort((a, b) => a.prioridade - b.prioridade);
}


// ─── Banco de dicas de crescimento ───────────────────────────────────────────
// Cada dica tem: id, categoria, icone, titulo, descricao, dificuldade, impacto,
// acao, e uma função `quando(ctx)` que decide se ela é relevante no contexto.
// ctx = { comVendas, fieis, novos, semVendas, dormentes, v7d, v30d,
//          receitaV30, receitaV60, topServico, topQtd, servicos, vendas }

const BANCO_DICAS = [

  // ── CAPTAÇÃO ──────────────────────────────────────────────────────────────
  {
    id: "cap-indicacao-fieis",
    categoria: "Captação",
    icone: "🤝",
    titulo: (ctx) => `${ctx.fieis.length} clientes fiéis prontos para indicar`,
    descricao: (ctx) => `${ctx.fieis[0]?.nome?.split(" ")[0]} e mais ${ctx.fieis.length - 1} cliente${ctx.fieis.length > 2 ? "s" : ""} já confiam no seu trabalho. Um pedido direto de indicação — via WhatsApp, com um script curto — costuma trazer 1 novo cliente a cada 3 abordagens.`,
    dificuldade: "fácil", impacto: "alto", acao: "Pedir indicação",
    quando: (ctx) => ctx.fieis.length >= 2,
  },
  {
    id: "cap-parcerias-locais",
    categoria: "Captação",
    icone: "🏪",
    titulo: () => "Parcerias locais como canal de aquisição",
    descricao: (ctx) => `Com ${ctx.comVendas.length} cliente${ctx.comVendas.length !== 1 ? "s" : ""} na base, parcerias com negócios complementares (eventos, decoração, buffet) podem dobrar sua visibilidade sem custo de mídia. Ofereça uma comissão ou troca de indicações.`,
    dificuldade: "médio", impacto: "alto", acao: "Mapear parceiros",
    quando: (ctx) => ctx.comVendas.length < 20,
  },
  {
    id: "cap-contatos-frios",
    categoria: "Captação",
    icone: "👤",
    titulo: (ctx) => `${ctx.semVendas.length} contato${ctx.semVendas.length > 1 ? "s" : ""} cadastrado${ctx.semVendas.length > 1 ? "s" : ""} sem nenhuma compra`,
    descricao: () => `Esses leads já demonstraram interesse mas não fecharam. Uma mensagem curta e personalizada agora — sem pitch de venda, apenas verificando se ainda têm a necessidade — costuma converter 10–20% deles.`,
    dificuldade: "fácil", impacto: "médio", acao: "Abordar contatos",
    quando: (ctx) => ctx.semVendas.length > 0,
  },
  {
    id: "cap-depoimentos",
    categoria: "Captação",
    icone: "⭐",
    titulo: () => "Depoimentos de clientes como prova social",
    descricao: (ctx) => `Peça um depoimento rápido (texto ou vídeo de 30s) para ${ctx.fieis[0]?.nome?.split(" ")[0] || "seus clientes fiéis"}. Depoimentos reais no Instagram ou Google Meu Negócio aumentam a conversão de novos clientes em até 40%.`,
    dificuldade: "fácil", impacto: "médio", acao: "Coletar depoimento",
    quando: (ctx) => ctx.fieis.length >= 1,
  },
  {
    id: "cap-google-meu-negocio",
    categoria: "Captação",
    icone: "📍",
    titulo: () => "Google Meu Negócio: captação gratuita local",
    descricao: () => `Um perfil otimizado no Google Meu Negócio aparece em buscas como "fotógrafo em [cidade]" sem custo. Adicione fotos do seu trabalho, horários e peça avaliações — é a fonte de captação local mais subestimada.`,
    dificuldade: "fácil", impacto: "alto", acao: "Otimizar perfil",
    quando: () => true,
  },
  {
    id: "cap-reativacao-base",
    categoria: "Captação",
    icone: "📅",
    titulo: (ctx) => `Semana parada — ${ctx.v30d.length} venda${ctx.v30d.length !== 1 ? "s" : ""} no mês`,
    descricao: (ctx) => `Nenhuma venda nos últimos 7 dias. Reativar quem já comprou é 5× mais barato do que captar novo cliente. Escolha ${Math.min(3, ctx.comVendas.length)} clientes e mande uma mensagem hoje.`,
    dificuldade: "fácil", impacto: "alto", acao: "Reativar agora",
    quando: (ctx) => ctx.v7d.length === 0 && ctx.v30d.length > 0,
  },

  // ── FIDELIZAÇÃO ───────────────────────────────────────────────────────────
  {
    id: "fid-segunda-compra",
    categoria: "Fidelização",
    icone: "✨",
    titulo: (ctx) => `${ctx.novos.length} cliente${ctx.novos.length > 1 ? "s" : ""} com apenas 1 compra`,
    descricao: (ctx) => `Quem compra pela segunda vez tem 5× mais chance de virar cliente recorrente. De ${ctx.novos.length} cliente${ctx.novos.length > 1 ? "s" : ""} novos, uma oferta personalizada agora pode transformar vários em fiéis antes de esfriarem.`,
    dificuldade: "fácil", impacto: "alto", acao: "Fidelizar novos",
    quando: (ctx) => ctx.novos.length > 0,
  },
  {
    id: "fid-aniversario",
    categoria: "Fidelização",
    icone: "🎂",
    titulo: () => "Mensagem de aniversário como touchpoint de retenção",
    descricao: () => `Uma mensagem no aniversário do cliente (com um desconto exclusivo ou mimo) gera lembrança da marca e aumenta a retenção. Peça a data no cadastro e automatize com uma automação no CRM.`,
    dificuldade: "médio", impacto: "médio", acao: "Configurar automação",
    quando: () => true,
  },
  {
    id: "fid-programa-fidelidade",
    categoria: "Fidelização",
    icone: "🏆",
    titulo: (ctx) => `Com ${ctx.comVendas.length} clientes, vale criar um programa de fidelidade`,
    descricao: () => `Um cartão simples de "compre 5, ganhe 1" aumenta a frequência de retorno em até 30%. Não precisa de app — um cartão impresso ou digital no WhatsApp já funciona.`,
    dificuldade: "fácil", impacto: "médio", acao: "Criar programa",
    quando: (ctx) => ctx.comVendas.length >= 5,
  },
  {
    id: "fid-reativar-dormentes",
    categoria: "Fidelização",
    icone: "😴",
    titulo: (ctx) => `${ctx.dormentes} cliente${ctx.dormentes > 1 ? "s" : ""} dormentes (+60 dias sem comprar)`,
    descricao: (ctx) => `${ctx.dormentes} cliente${ctx.dormentes > 1 ? "s estão" : " está"} há mais de 2 meses sem aparecer. Uma campanha de reativação com desconto exclusivo ou novidade costuma trazer 15–25% de volta.`,
    dificuldade: "fácil", impacto: "alto", acao: "Reativar dormentes",
    quando: (ctx) => ctx.dormentes > 0,
  },
  {
    id: "fid-followup-pos-servico",
    categoria: "Fidelização",
    icone: "💬",
    titulo: () => "Follow-up pós-serviço: o toque que fideliza",
    descricao: () => `Mandar uma mensagem 3–5 dias após o serviço ("como ficou?") aumenta a satisfação percebida e abre espaço para indicações espontâneas. Leva menos de 1 minuto e é altamente subestimado.`,
    dificuldade: "fácil", impacto: "médio", acao: "Criar rotina",
    quando: () => true,
  },

  // ── RECEITA ───────────────────────────────────────────────────────────────
  {
    id: "rec-combo-top-servico",
    categoria: "Receita",
    icone: "📦",
    titulo: (ctx) => `"${ctx.topServico}" vendido ${ctx.topQtd}× — hora de criar um pacote`,
    descricao: (ctx) => `Seu serviço mais vendido tem demanda comprovada. Um pacote combinando "${ctx.topServico}" com um serviço complementar pode aumentar o ticket médio em 30–50% sem precisar de novos clientes.`,
    dificuldade: "médio", impacto: "alto", acao: "Criar pacote",
    quando: (ctx) => ctx.topServico && ctx.topQtd >= 3,
  },
  {
    id: "rec-precificacao",
    categoria: "Receita",
    icone: "💰",
    titulo: () => "Quando foi a última vez que você reajustou os preços?",
    descricao: (ctx) => `Com ticket médio de R$ ${ctx.ticketMedio?.toLocaleString("pt-BR") || "—"}, um reajuste de 10–15% bem comunicado raramente perde clientes fiéis e pode aumentar a receita mensal sem captar ninguém novo.`,
    dificuldade: "médio", impacto: "alto", acao: "Revisar preços",
    quando: (ctx) => ctx.comVendas.length >= 3,
  },
  {
    id: "rec-upsell-complementar",
    categoria: "Receita",
    icone: "⬆️",
    titulo: () => "Upsell: ofereça o próximo passo natural",
    descricao: () => `Na entrega do serviço, mencione um complemento relacionado. "Já que você fez X, muitos clientes também aproveitam Y para..." — essa abordagem consultiva aumenta o ticket sem parecer venda.`,
    dificuldade: "fácil", impacto: "médio", acao: "Treinar abordagem",
    quando: (ctx) => ctx.servicos.length >= 2,
  },
  {
    id: "rec-antecipacao-demanda",
    categoria: "Receita",
    icone: "🗓️",
    titulo: () => "Crie uma oferta de pré-agendamento com desconto",
    descricao: () => `Ofereça 10% de desconto para quem agendar com 30+ dias de antecedência. Isso previsibiliza sua receita, ocupa agenda no tempo certo e reduz cancelamentos de última hora.`,
    dificuldade: "fácil", impacto: "médio", acao: "Criar oferta",
    quando: () => true,
  },
  {
    id: "rec-produto-fisico",
    categoria: "Receita",
    icone: "🖼️",
    titulo: () => "Produtos físicos como segunda fonte de receita",
    descricao: () => `Álbuns impressos, quadros e prints têm margem alta e o cliente percebe muito mais valor do que em um arquivo digital. Se ainda não oferece, vale testar com um fornecedor parceiro.`,
    dificuldade: "médio", impacto: "alto", acao: "Explorar fornecedor",
    quando: () => true,
  },
  {
    id: "rec-momento-trafego",
    categoria: "Receita",
    icone: "📈",
    titulo: (ctx) => `R$ ${ctx.receitaV30.toLocaleString("pt-BR")} em 30 dias — momento de escalar`,
    descricao: () => `Com a base aquecida e receita estável, esse é o momento certo para investir em tráfego pago. R$ 300–500 em Meta Ads bem segmentados podem dobrar o volume de leads qualificados.`,
    dificuldade: "médio", impacto: "alto", acao: "Planejar campanha",
    quando: (ctx) => ctx.receitaV30 >= 500,
  },

  // ── DIGITAL ───────────────────────────────────────────────────────────────
  {
    id: "dig-instagram-portfolio",
    categoria: "Digital",
    icone: "📸",
    titulo: () => "Portfólio ativo no Instagram como vitrine gratuita",
    descricao: () => `Postar 3× por semana com resultados reais (antes/depois, bastidores, depoimentos) é a forma mais eficiente de captação orgânica para prestadores de serviço. Consistência supera qualidade de edição.`,
    dificuldade: "médio", impacto: "alto", acao: "Planejar conteúdo",
    quando: () => true,
  },
  {
    id: "dig-whatsapp-status",
    categoria: "Digital",
    icone: "💚",
    titulo: () => "WhatsApp Status: canal ignorado com alto alcance",
    descricao: () => `Status do WhatsApp chega a todos os contatos sem algoritmo. Postar bastidores, resultados e disponibilidade de agenda 2–3× por semana mantém você no radar sem custo.`,
    dificuldade: "fácil", impacto: "médio", acao: "Começar hoje",
    quando: () => true,
  },
  {
    id: "dig-landing-page-captura",
    categoria: "Digital",
    icone: "🔗",
    titulo: () => "Uma landing page de captura pode automatizar seus leads",
    descricao: () => `Com o formulário de captura do CRM, você já tem a infraestrutura. Criar uma página simples com link na bio do Instagram transforma visualizações em leads automáticos — sem precisar responder DMs manualmente.`,
    dificuldade: "médio", impacto: "alto", acao: "Ativar captura",
    quando: () => true,
  },
  {
    id: "dig-reels-depoimento",
    categoria: "Digital",
    icone: "🎬",
    titulo: () => "Reels com depoimento de cliente: o conteúdo que mais converte",
    descricao: () => `Um vídeo de 30s do cliente contando a experiência — filmado com celular, sem edição elaborada — gera mais confiança do que qualquer copy. Peça para 1 cliente fiel essa semana.`,
    dificuldade: "fácil", impacto: "alto", acao: "Gravar depoimento",
    quando: (ctx) => ctx.fieis.length >= 1,
  },

  // ── OPERACIONAL ───────────────────────────────────────────────────────────
  {
    id: "op-separar-financas",
    categoria: "Operacional",
    icone: "🏦",
    titulo: () => "Conta PJ separada: proteja seu negócio",
    descricao: () => `Misturar finanças pessoais e do negócio dificulta saber se você está lucrando de verdade. Uma conta PJ (ou conta digital gratuita como Mercado Pago) separa os fluxos e facilita o controle.`,
    dificuldade: "fácil", impacto: "médio", acao: "Abrir conta PJ",
    quando: () => true,
  },
  {
    id: "op-automatizar-confirmacao",
    categoria: "Operacional",
    icone: "🤖",
    titulo: () => "Automatize a confirmação de agendamento",
    descricao: () => `Uma mensagem automática 24h antes do serviço reduz cancelamentos em até 30%. Use as automações do CRM ou um template salvo no WhatsApp Business para não depender de memória.`,
    dificuldade: "fácil", impacto: "médio", acao: "Criar automação",
    quando: () => true,
  },
  {
    id: "op-controle-receita",
    categoria: "Operacional",
    icone: "📊",
    titulo: (ctx) => `Ticket médio de R$ ${ctx.ticketMedio?.toLocaleString("pt-BR") || "—"} — você sabe sua meta mensal?`,
    descricao: (ctx) => `Com ticket médio de R$ ${ctx.ticketMedio?.toLocaleString("pt-BR") || "—"}, você precisa de ${ctx.ticketMedio ? Math.ceil(3000 / ctx.ticketMedio) : "?"} vendas por mês para atingir R$ 3.000. Definir essa meta torna a prospecção mais objetiva.`,
    dificuldade: "fácil", impacto: "médio", acao: "Definir meta",
    quando: (ctx) => ctx.comVendas.length >= 2,
  },
  {
    id: "op-formalizar-negocio",
    categoria: "Operacional",
    icone: "📝",
    titulo: () => "MEI: formalize e abra portas para clientes maiores",
    descricao: () => `Ser MEI permite emitir nota fiscal, contratar com empresas e ter CNPJ — o que abre portas para clientes corporativos e eventos maiores. O custo mensal é de ~R$ 70 e o processo é online.`,
    dificuldade: "fácil", impacto: "alto", acao: "Abrir MEI",
    quando: () => true,
  },
];

// ─── Função principal de seleção de dicas ────────────────────────────────────
export function gerarDicas(clientesComScore, vendas = [], servicos = []) {
  const hoje    = new Date();
  const comVendas  = clientesComScore.filter(c => !c._semVendas);
  const fieis      = comVendas.filter(c => c.risco === "baixo" && c.totalCompras >= 2);
  const novos      = comVendas.filter(c => c.totalCompras === 1);
  const semVendas  = clientesComScore.filter(c => c._semVendas);
  const dormentes  = comVendas.filter(c => c.diasAusente > 60).length;

  const v7d  = vendas.filter(v => (hoje - toDate(v.data)) < 7  * 86400000);
  const v30d = vendas.filter(v => (hoje - toDate(v.data)) < 30 * 86400000);
  const v60d = vendas.filter(v => (hoje - toDate(v.data)) < 60 * 86400000);

  const receitaV30 = v30d.reduce((a, v) => a + (v.total ?? v.custoTotal ?? 0), 0);
  const receitaV60 = v60d.reduce((a, v) => a + (v.total ?? v.custoTotal ?? 0), 0);

  // Serviço mais vendido
  const contagem = {};
  vendas.forEach(v => (v.itens || []).forEach(i => {
    const nome = i.nome || i.produto;
    if (nome) contagem[nome] = (contagem[nome] || 0) + 1;
  }));
  const [[topServico, topQtd] = []] = Object.entries(contagem).sort((a, b) => b[1] - a[1]);

  // Ticket médio geral
  const ticketMedio = comVendas.length
    ? Math.round(comVendas.reduce((a, c) => a + (c.ticketMedio || 0), 0) / comVendas.length)
    : 0;

  const ctx = {
    comVendas, fieis, novos, semVendas, dormentes,
    v7d, v30d, v60d, receitaV30, receitaV60,
    topServico, topQtd, servicos, vendas, ticketMedio,
  };

  return BANCO_DICAS
    .filter(d => {
      try { return d.quando(ctx); }
      catch { return false; }
    })
    .map(d => ({
      id: d.id,
      tipo: "dica",
      categoria: d.categoria,
      icone: d.icone,
      titulo:    typeof d.titulo    === "function" ? d.titulo(ctx)    : d.titulo,
      descricao: typeof d.descricao === "function" ? d.descricao(ctx) : d.descricao,
      dificuldade: d.dificuldade,
      impacto:     d.impacto,
      acao:        d.acao,
    }));
}

// ─── Métricas do painel ───────────────────────────────────────────────────────
function calcularMetricas(clientesComScore, vendas = []) {
  const hoje = new Date();
  const trintaDias = new Date(hoje - 30 * 86400000);
  const com = clientesComScore.filter((c) => !c._semVendas);

  return {
    totalClientes: com.length,
    emRisco: com.filter((c) => c.risco === "alto" || c.risco === "medio").length,
    dormentes: com.filter((c) => c.diasAusente > 60).length,
    fieis: com.filter((c) => c.risco === "baixo" && c.totalCompras >= 2).length,
    novos: com.filter((c) => c.totalCompras === 1).length,
    receitaEmRisco: com
      .filter((c) => c.risco === "alto" || c.risco === "medio")
      .reduce((a, c) => a + (c.ticketMedio || 0), 0),
    receitaRecente: vendas
      .filter((v) => toDate(v.data) >= trintaDias)
      .reduce((a, v) => a + (v.total ?? v.custoTotal ?? 0), 0),
    ticketGeral: com.length
      ? Math.round(com.reduce((a, c) => a + (c.ticketMedio || 0), 0) / com.length)
      : 0,
  };
}

// ─── Hook principal ───────────────────────────────────────────────────────────
export function useCRM(empresaId) {
  const [estado, setEstado] = useState({
    carregando: true,
    erro: null,
    dadosBrutos: null,
    clientes: [],
    insights: [],
    dicas: [],
    metricas: null,
    config: null,
    ignorados: [],
    radar: RADAR_PADRAO,
  });

  useEffect(() => {
    if (!empresaId) return;

    const buffer = {
      clientes:  [],
      vendas:    [],
      servicos:  [],
      config:    {},
      ignorados: [],
      radar:     {},
    };

    const pronto = {
      clientes:  false,
      vendas:    false,
      servicos:  false,
      config:    false,
      ignorados: false,
      radar:     false,
    };

    function recalcular() {
      if (
        !pronto.clientes  ||
        !pronto.vendas    ||
        !pronto.servicos  ||
        !pronto.config    ||
        !pronto.ignorados ||
        !pronto.radar
      ) return;

      const radar = { ...RADAR_PADRAO, ...buffer.radar };
      const clientesComScore = calcularScoreChurn(buffer.clientes, buffer.vendas, radar);
      const insights = gerarInsights(
        clientesComScore,
        buffer.vendas,
        buffer.servicos,
        buffer.ignorados
      );
      const metricas = calcularMetricas(clientesComScore, buffer.vendas);
      const dicas    = gerarDicas(clientesComScore, buffer.vendas, buffer.servicos);

      setEstado({
        carregando: false,
        erro: null,
        dadosBrutos: { ...buffer },
        clientes: clientesComScore,
        insights,
        dicas,
        metricas,
        config: buffer.config,
        ignorados: buffer.ignorados,
        radar,
      });
    }

    function onErro(secao) {
      return (err) => {
        console.error(`[useCRM] Erro em "${secao}":`, err);
        setEstado((s) => ({ ...s, carregando: false, erro: `Erro ao carregar ${secao}.` }));
      };
    }

    const unsubs = [];

    unsubs.push(
      onSnapshot(
        collection(db, "users", empresaId, "clientes"),
        (snap) => {
          buffer.clientes = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          pronto.clientes = true;
          recalcular();
        },
        onErro("clientes")
      )
    );

    unsubs.push(
      onSnapshot(
        collection(db, "users", empresaId, "vendas"),
        (snap) => {
          buffer.vendas = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          pronto.vendas = true;
          recalcular();
        },
        onErro("vendas")
      )
    );

    unsubs.push(
      onSnapshot(
        collection(db, "users", empresaId, "servicos"),
        (snap) => {
          buffer.servicos = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          pronto.servicos = true;
          recalcular();
        },
        onErro("serviços")
      )
    );

    unsubs.push(
      onSnapshot(
        doc(db, "users", empresaId, "config", "geral"),
        (snap) => {
          buffer.config = snap.exists() ? snap.data() : {};
          pronto.config = true;
          recalcular();
        },
        (err) => {
          console.warn("[useCRM] Config não encontrada:", err);
          pronto.config = true;
          recalcular();
        }
      )
    );

    // ── Ignorados: dadosCRM/{empresaId}/ignore ──────────────────────────────
    unsubs.push(
      onSnapshot(
        collection(db, "dadosCRM", empresaId, "ignore"),
        (snap) => {
          buffer.ignorados = snap.docs.map((d) => ({ _docId: d.id, ...d.data() }));
          pronto.ignorados = true;
          recalcular();
        },
        (err) => {
          // Coleção pode ainda não existir: não bloqueia o sistema
          console.warn("[useCRM] Coleção ignore não encontrada (normal na 1ª vez):", err);
          pronto.ignorados = true;
          recalcular();
        }
      )
    );

    // ── Radar: dadosCRM/{empresaId}/radar/risco ─────────────────────────────
    // Se o doc não existir, usa RADAR_PADRAO — não bloqueia o sistema.
    unsubs.push(
      onSnapshot(
        doc(db, "dadosCRM", empresaId, "radar", "risco"),
        (snap) => {
          buffer.radar = snap.exists() ? snap.data() : {};
          pronto.radar = true;
          recalcular();
        },
        (err) => {
          console.warn("[useCRM] Config radar não encontrada (usando padrão):", err);
          buffer.radar = {};
          pronto.radar = true;
          recalcular();
        }
      )
    );

    return () => unsubs.forEach((u) => u());
  }, [empresaId]);

  return estado;
}

// ─── Gerador de prompt para IA ────────────────────────────────────────────────
export function montarPromptMensagem(insight, empresaNome) {
  const empresa = empresaNome || "nossa agência";

  const system = `Você é um gestor de relacionamento da "${empresa}". 
  Sua missão é escrever uma mensagem de WhatsApp extremamente humana e curta (máximo 3 linhas).
  REGRAS:
  - Use um tom de "parceria", não de "vendedor".
  - Nunca use "espero que esteja bem" ou "notamos que você sumiu".
  - Se houver um produto favorito, mencione algo sobre o valor dele.
  - Termine com uma pergunta aberta.
  - Saída: Apenas o texto da mensagem.`;

  let user = "";
  if (insight.tipo === "risco") {
    user = `Cliente: ${insight.cliente}. Serviço: ${insight.produtoFavorito || "nossos serviços"}. Ausente há ${insight.diasAusente} dias. 
    Escreva um oi rápido, dizendo que lembrou dele ao organizar a agenda e pergunte como estão os planos dessa semana.`;
  } else if (insight.tipo === "oportunidade") {
    user = `Cliente: ${insight.cliente}. Já faz ${insight.produtoFavorito}, mas nunca usou "${insight.servico}". 
    Sugira esse novo serviço como algo que pode escalar os resultados que ele já tem.`;
  }

  return { system, user };
}
