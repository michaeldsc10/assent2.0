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
export const RADAR_PADRAO = {
  diasMedio: 15,
  diasAlto:  30,
  multMedio: 1.5,
  multAlto:  2.5,
};

// ─── Helper: converte Timestamp ou string para Date ───────────────────────────
function toDate(val) {
  if (!val) return null;
  if (val?.toDate) return val.toDate();
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

// ─── Helper: compara nome do cliente com tolerância a nomes parciais ──────────
function matchNomeCliente(vendaCliente = "", clienteNome = "") {
  const a = (vendaCliente || "").trim().toLowerCase();
  const b = (clienteNome  || "").trim().toLowerCase();
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
      .filter((v) => v._data !== null)
      .sort((a, b) => a._data - b._data);

    if (vendasCliente.length === 0) {
      return { ...cliente, _semVendas: true, risco: "indefinido" };
    }

    const ultima     = vendasCliente[vendasCliente.length - 1];
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

    const totalGasto  = vendasCliente.reduce((acc, v) => acc + (v.total ?? v.custoTotal ?? 0), 0);
    const ticketMedio = vendasCliente.length > 0 ? Math.round(totalGasto / vendasCliente.length) : 0;

    const contagem = {};
    vendasCliente.forEach((v) =>
      (v.itens || []).forEach((i) => {
        const nomeProduto = i.nome || i.produto || "Desconhecido";
        contagem[nomeProduto] = (contagem[nomeProduto] || 0) + 1;
      })
    );
    const produtoFavorito =
      Object.entries(contagem).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    const mult = (frequenciaMedia && frequenciaMedia > 0) ? diasAusente / frequenciaMedia : null;
    let risco  = "baixo";
    if (mult !== null) {
      if (mult > multAlto)   risco = "alto";
      else if (mult > multMedio) risco = "medio";
    } else {
      if (diasAusente > diasAlto)   risco = "alto";
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
        produtoFavorito: c.produtoFavorito,
        descricao: `Sempre contrata ${catFav}, mas nunca experimentou "${naoComprado.nome}". Potencial: +R$ ${naoComprado.preco}.`,
      });
    }
  });

  return insights.sort((a, b) => a.prioridade - b.prioridade);
}

// ─── Diagnóstico do momento da empresa ───────────────────────────────────────
export function diagnosticarMomento(clientesComScore, vendas = []) {
  const hoje      = new Date();
  const comVendas = clientesComScore.filter(c => !c._semVendas);
  const semVendas = clientesComScore.filter(c => c._semVendas);

  const v7d  = vendas.filter(v => { try { return (hoje - (v.data?.toDate ? v.data.toDate() : new Date(v.data))) < 7*86400000;  } catch { return false; } });
  const v30d = vendas.filter(v => { try { return (hoje - (v.data?.toDate ? v.data.toDate() : new Date(v.data))) < 30*86400000; } catch { return false; } });
  const v90d = vendas.filter(v => { try { return (hoje - (v.data?.toDate ? v.data.toDate() : new Date(v.data))) < 90*86400000; } catch { return false; } });

  const emRisco   = comVendas.filter(c => c.risco === "alto" || c.risco === "medio");
  const fieis     = comVendas.filter(c => c.risco === "baixo" && c.totalCompras >= 2);
  const novos     = comVendas.filter(c => c.totalCompras === 1);
  const dormentes = comVendas.filter(c => c.diasAusente > 60);

  const receitaV30 = v30d.reduce((a, v) => a + (v.total ?? v.custoTotal ?? 0), 0);
  const receitaV90 = v90d.reduce((a, v) => a + (v.total ?? v.custoTotal ?? 0), 0);

  const contagemServicos = {};
  vendas.forEach(v => (v.itens || []).forEach(i => {
    const nome = i.nome || i.produto;
    if (nome) contagemServicos[nome] = (contagemServicos[nome] || 0) + 1;
  }));
  const [[topServico, topQtd] = []] = Object.entries(contagemServicos).sort((a, b) => b[1] - a[1]);

  const ticketMedio = comVendas.length
    ? Math.round(comVendas.reduce((a, c) => a + (c.ticketMedio || 0), 0) / comVendas.length)
    : 0;

  let fase;
  if (comVendas.length === 0)                              fase = "base_vazia";
  else if (comVendas.length < 5)                           fase = "construcao";
  else if (emRisco.length > comVendas.length * 0.4)        fase = "retencao_critica";
  else if (v30d.length === 0 && comVendas.length >= 3)     fase = "estagnado";
  else if (comVendas.length >= 10 && receitaV30 >= 1000)   fase = "escalonando";
  else                                                      fase = "crescendo";

  const nomesContatos  = semVendas.slice(0, 3).map(c => c.nome?.split(" ")[0]).filter(Boolean);
  const nomesEmRisco   = emRisco.slice(0, 3).map(c => c.nome?.split(" ")[0]).filter(Boolean);
  const nomesDormentes = dormentes.slice(0, 2).map(c => c.nome?.split(" ")[0]).filter(Boolean);
  const nomesNovos     = novos.slice(0, 3).map(c => c.nome?.split(" ")[0]).filter(Boolean);
  const maxDiasRisco   = emRisco.length ? Math.max(...emRisco.map(c => c.diasAusente || 0)) : 0;

  return {
    fase,
    totalClientes: comVendas.length,
    semVendas: semVendas.length,
    emRisco: emRisco.length,
    fieis: fieis.length,
    nomePrimeiroFiel: fieis[0]?.nome || null,
    novos: novos.length,
    dormentes: dormentes.length,
    receitaV30,
    receitaV90,
    ticketMedio,
    topServico: topServico || null,
    topQtd: topQtd || 0,
    v7dLength: v7d.length,
    v30dLength: v30d.length,
    taxaRisco: comVendas.length ? emRisco.length / comVendas.length : 0,
    nomesContatos,
    nomesEmRisco,
    nomesDormentes,
    nomesNovos,
    maxDiasRisco,
  };
}

// ─── Banco de insights de crescimento ────────────────────────────────────────
const BANCO_INSIGHTS_CRESCIMENTO = [
  {
    id: "igr-indicacao-fieis",
    fases: ["crescendo", "construcao", "escalonando"],
    categoria: "Captação",
    quando: (m) => m.fieis >= 2,
    metrica: (m) => ({ valor: m.fieis, label: "clientes fiéis" }),
    titulo: (m) => `${m.fieis} clientes prontos para indicar`,
    diagnostico: (m) => `${m.nomePrimeiroFiel ? m.nomePrimeiroFiel.split(" ")[0] : "Seus clientes fiéis"}${m.fieis > 1 ? ` e outros ${m.fieis - 1}` : ""} com mais de uma compra são sua fonte mais barata de aquisição.`,
    recomendacao: (m) => `Entre em contato direto com ${m.nomePrimeiroFiel ? m.nomePrimeiroFiel.split(" ")[0] : "esses clientes"}, mencione o trabalho feito e peça um nome. Um pedido personalizado converte 3× mais que qualquer campanha.`,
  },
  {
    id: "igr-contatos-sem-historico",
    fases: ["construcao", "crescendo", "estagnado"],
    categoria: "Captação",
    quando: (m) => m.semVendas > 0,
    metrica: (m) => ({ valor: m.semVendas, label: `contato${m.semVendas > 1 ? "s" : ""} sem compra` }),
    titulo: (m) => `${m.semVendas} contato${m.semVendas > 1 ? "s" : ""} cadastrado${m.semVendas > 1 ? "s" : ""} sem histórico`,
    diagnostico: (m) => {
      const lista = m.nomesContatos?.length
        ? `${m.nomesContatos.join(", ")} ${m.semVendas > m.nomesContatos.length ? `e mais ${m.semVendas - m.nomesContatos.length}` : ""} demonstraram`
        : `Esses ${m.semVendas} contatos demonstraram`;
      return `${lista} interesse mas não fecharam. O calor da intenção inicial cai rápido — cada semana sem contato reduz a chance de conversão.`;
    },
    recomendacao: (m) => `Uma mensagem direta e curta para ${m.nomesContatos?.[0] || "cada um deles"} esta semana — sem pitch, apenas verificando se a necessidade ainda existe — costuma converter 10–20%.`,
  },
  {
    id: "igr-base-pequena-parceria",
    fases: ["construcao", "base_vazia"],
    categoria: "Captação",
    quando: (m) => m.totalClientes < 8,
    metrica: (m) => ({ valor: m.totalClientes, label: "clientes com histórico" }),
    titulo: () => "Parcerias locais como canal primário",
    diagnostico: (m) => `Com ${m.totalClientes} cliente${m.totalClientes !== 1 ? "s" : ""}, mídia paga ainda tem ROI incerto. Negócios complementares que atendem o mesmo público são mais eficientes nessa fase.`,
    recomendacao: () => `Mapeie 3 negócios próximos com o mesmo público (eventos, buffet, decoração) e proponha uma troca de indicação formal — sem custo, resultado imediato.`,
  },
  {
    id: "igr-semana-parada",
    fases: ["crescendo", "estagnado", "construcao"],
    categoria: "Ativação",
    quando: (m) => m.v7dLength === 0 && m.v30dLength > 0,
    metrica: (m) => ({ valor: m.v30dLength, label: `venda${m.v30dLength > 1 ? "s" : ""} no último mês` }),
    titulo: () => "Nenhuma venda nos últimos 7 dias",
    diagnostico: (m) => `Você teve ${m.v30dLength} venda${m.v30dLength > 1 ? "s" : ""} no mês mas a semana está parada. Reativar quem já comprou custa 5× menos do que captar novo cliente.`,
    recomendacao: (m) => `Selecione ${m.nomesNovos?.length ? `${m.nomesNovos.slice(0,2).join(", ")} e mais 1 cliente` : "3 clientes"} com compra recente e envie uma mensagem hoje. Não precisa de oferta — uma mensagem de acompanhamento já reabre o canal.`,
  },
  {
    id: "igr-retencao-critica",
    fases: ["retencao_critica"],
    categoria: "Retenção",
    quando: (m) => m.emRisco >= 2,
    metrica: (m) => ({ valor: `${Math.round(m.taxaRisco * 100)}%`, label: "da base em risco" }),
    titulo: (m) => `${m.emRisco} clientes em risco — prioridade máxima`,
    diagnostico: (m) => `Mais de ${Math.round(m.taxaRisco * 100)}% da sua base está fora do intervalo normal de retorno${m.nomesEmRisco?.length ? ` — inclui ${m.nomesEmRisco.join(", ")}` : ""}. Em negócios de serviço, essa taxa acima de 30% sinaliza problema sistêmico.`,
    recomendacao: (m) => `Antes de captar novos clientes, recupere ${m.nomesEmRisco?.[0] || "quem"} e os demais que já conhecem seu trabalho. Use o Radar para ver quem contatar hoje — o custo de inatividade é maior que o de qualquer campanha.`,
  },
  {
    id: "igr-dormentes",
    fases: ["retencao_critica", "crescendo", "estagnado"],
    categoria: "Retenção",
    quando: (m) => m.dormentes >= 2,
    metrica: (m) => ({ valor: m.dormentes, label: `cliente${m.dormentes > 1 ? "s" : ""} +60 dias` }),
    titulo: (m) => `${m.dormentes} clientes há mais de 60 dias sem comprar`,
    diagnostico: (m) => `${m.nomesDormentes?.length ? `${m.nomesDormentes.join(", ")} ${m.dormentes > m.nomesDormentes.length ? `e outros ${m.dormentes - m.nomesDormentes.length}` : ""} estão` : `${m.dormentes} clientes estão`} há mais de 60 dias sem comprar — raramente voltam por conta própria, mas respondem bem a contato direto personalizado.`,
    recomendacao: (m) => `Uma campanha de reativação focada em "você sumiu" — com algo de novo para mostrar ${m.topServico ? `como "${m.topServico}"` : ""} — costuma trazer 15–25% de volta no primeiro mês.`,
  },
  {
    id: "igr-segunda-compra",
    fases: ["construcao", "crescendo"],
    categoria: "Fidelização",
    quando: (m) => m.novos >= 2,
    metrica: (m) => ({ valor: m.novos, label: `cliente${m.novos > 1 ? "s" : ""} com 1 compra` }),
    titulo: (m) => `${m.novos} clientes fizeram apenas 1 compra`,
    diagnostico: (m) => `A segunda compra é o marco de fidelização. ${m.nomesNovos?.length ? `${m.nomesNovos.join(", ")} ${m.novos > m.nomesNovos.length ? `e mais ${m.novos - m.nomesNovos.length}` : ""} ainda` : `Esses ${m.novos} clientes ainda`} não voltaram — e têm 5× mais chance de se tornar recorrentes do que um novo contato.`,
    recomendacao: (m) => `Identifique quem comprou pela primeira vez nos últimos 30 dias${m.nomesNovos?.length ? ` — ${m.nomesNovos[0]} é um bom ponto de partida` : ""} — e faça uma abordagem personalizada com algo relacionado ao que já contratou.`,
  },
  {
    id: "igr-pacote-top-servico",
    fases: ["crescendo", "escalonando", "construcao"],
    categoria: "Receita",
    quando: (m) => m.topServico && m.topQtd >= 3,
    metrica: (m) => ({ valor: `${m.topQtd}×`, label: `"${m.topServico ? m.topServico.slice(0, 20) : ''}" vendido` }),
    titulo: (m) => `"${m.topServico}" tem demanda comprovada`,
    diagnostico: (m) => `Vendido ${m.topQtd} vezes, é seu serviço com maior tração. A maioria dos negócios nessa fase deixa receita na mesa por não ter uma oferta de pacote estruturada em torno do que já funciona.`,
    recomendacao: () => `Monte um pacote combinando esse serviço com um complementar. Aumento de ticket médio sem precisar de novos clientes é a alavanca mais eficiente em qualquer fase.`,
  },
  {
    id: "igr-ticket-reajuste",
    fases: ["crescendo", "escalonando"],
    categoria: "Receita",
    quando: (m) => m.totalClientes >= 4 && m.ticketMedio > 0,
    metrica: (m) => ({ valor: `R$ ${m.ticketMedio.toLocaleString("pt-BR")}`, label: "ticket médio atual" }),
    titulo: () => "Margem de reajuste de preço sem perder clientes",
    diagnostico: (m) => `Com ${m.fieis} cliente${m.fieis !== 1 ? "s" : ""} fiel${m.fieis !== 1 ? "s" : ""}${m.nomePrimeiroFiel ? ` (${m.nomePrimeiroFiel.split(" ")[0]} entre eles)` : ""} e ticket médio de R$ ${m.ticketMedio.toLocaleString("pt-BR")}, um reajuste de 10–15% bem comunicado raramente gera cancelamentos — e aumenta a receita sem nenhuma captação nova.`,
    recomendacao: () => `Comunique antes, mostre o valor entregue, aplique para novos contratos primeiro. Clientes fiéis aceitam reajuste quando confiam no serviço.`,
  },
  {
    id: "igr-trafego-pago",
    fases: ["crescendo", "escalonando"],
    categoria: "Captação",
    quando: (m) => m.receitaV30 >= 800 && m.fieis >= 3,
    metrica: (m) => ({ valor: `R$ ${m.receitaV30.toLocaleString("pt-BR")}`, label: "receita nos últimos 30 dias" }),
    titulo: () => "Momento favorável para escalar com tráfego pago",
    diagnostico: (m) => `Com R$ ${m.receitaV30.toLocaleString("pt-BR")} gerados no mês e base fidelizada, você tem dados suficientes para criar um público similar e testar campanhas com baixo risco.`,
    recomendacao: () => `R$ 300–500 em Meta Ads segmentados por interesses do seu público já geram aprendizado de campanha. Sem base consolidada, o investimento em tráfego é prematuro.`,
  },
  {
    id: "igr-escala-processos",
    fases: ["escalonando"],
    categoria: "Operacional",
    quando: (m) => m.totalClientes >= 10,
    metrica: (m) => ({ valor: m.totalClientes, label: "clientes na base" }),
    titulo: () => "Volume exige processos — antes de crescer mais",
    diagnostico: (m) => `Com ${m.totalClientes} clientes, o gargalo muda de captação para operação. Negócios que crescem sem estrutura de atendimento perdem qualidade e aumentam o churn sem perceber.`,
    recomendacao: () => `Documente o fluxo de atendimento, automatize confirmações e padronize a entrega. Processos permitem escalar sem depender da sua memória.`,
  },
  {
    id: "igr-prova-social",
    fases: ["crescendo", "escalonando"],
    categoria: "Captação",
    quando: (m) => m.fieis >= 3,
    metrica: (m) => ({ valor: m.fieis, label: "clientes fiéis com histórico" }),
    titulo: () => "Depoimentos como ativo de captação",
    diagnostico: (m) => `${m.nomePrimeiroFiel ? `${m.nomePrimeiroFiel.split(" ")[0]} e outros ${m.fieis - 1} com` : `${m.fieis} clientes com`} histórico de retorno são prova social viva. Esse ativo é subutilizado — raramente documentado e quase nunca usado como material de captação.`,
    recomendacao: (m) => `Peça um depoimento em texto ou vídeo de 30s para ${m.nomePrimeiroFiel ? m.nomePrimeiroFiel.split(" ")[0] : "2 clientes"} esta semana. Publicado no Instagram ou Google, aumenta a conversão de novos contatos em até 40%.`,
  },
];

// ─── Exporta insights filtrados pelo momento atual ────────────────────────────
export function gerarInsightsCrescimento(clientesComScore, vendas = [], servicos = []) {
  const momento = diagnosticarMomento(clientesComScore, vendas);

  const ativos = BANCO_INSIGHTS_CRESCIMENTO
    .filter(ins => {
      if (!ins.fases.includes(momento.fase)) return false;
      try { return ins.quando(momento); }
      catch { return false; }
    })
    .map(ins => ({
      id:           ins.id,
      categoria:    ins.categoria,
      metrica:      ins.metrica(momento),
      titulo:       ins.titulo(momento),
      diagnostico:  ins.diagnostico(momento),
      recomendacao: ins.recomendacao(momento),
    }));

  return { momento, ativos };
}

// ─── Métricas do painel ───────────────────────────────────────────────────────
function calcularMetricas(clientesComScore, vendas = []) {
  const hoje      = new Date();
  const trintaDias = new Date(hoje - 30 * 86400000);
  const com       = clientesComScore.filter((c) => !c._semVendas);

  return {
    totalClientes: com.length,
    emRisco:   com.filter((c) => c.risco === "alto" || c.risco === "medio").length,
    dormentes: com.filter((c) => c.diasAusente > 60).length,
    fieis:     com.filter((c) => c.risco === "baixo" && c.totalCompras >= 2).length,
    novos:     com.filter((c) => c.totalCompras === 1).length,
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
    crescimento: { momento: null, ativos: [] },
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

      const radar            = { ...RADAR_PADRAO, ...buffer.radar };
      const clientesComScore = calcularScoreChurn(buffer.clientes, buffer.vendas, radar);
      const insights         = gerarInsights(clientesComScore, buffer.vendas, buffer.servicos, buffer.ignorados);
      const metricas         = calcularMetricas(clientesComScore, buffer.vendas);
      const crescimento      = gerarInsightsCrescimento(clientesComScore, buffer.vendas, buffer.servicos);

      setEstado({
        carregando: false,
        erro: null,
        dadosBrutos: { ...buffer },
        clientes: clientesComScore,
        insights,
        crescimento,
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
        (snap) => { buffer.clientes = snap.docs.map((d) => ({ id: d.id, ...d.data() })); pronto.clientes = true; recalcular(); },
        onErro("clientes")
      )
    );

    unsubs.push(
      onSnapshot(
        collection(db, "users", empresaId, "vendas"),
        (snap) => { buffer.vendas = snap.docs.map((d) => ({ id: d.id, ...d.data() })); pronto.vendas = true; recalcular(); },
        onErro("vendas")
      )
    );

    unsubs.push(
      onSnapshot(
        collection(db, "users", empresaId, "servicos"),
        (snap) => { buffer.servicos = snap.docs.map((d) => ({ id: d.id, ...d.data() })); pronto.servicos = true; recalcular(); },
        onErro("serviços")
      )
    );

    unsubs.push(
      onSnapshot(
        doc(db, "users", empresaId, "config", "geral"),
        (snap) => { buffer.config = snap.exists() ? snap.data() : {}; pronto.config = true; recalcular(); },
        (err) => { console.warn("[useCRM] Config não encontrada:", err); pronto.config = true; recalcular(); }
      )
    );

    unsubs.push(
      onSnapshot(
        collection(db, "dadosCRM", empresaId, "ignore"),
        (snap) => { buffer.ignorados = snap.docs.map((d) => ({ _docId: d.id, ...d.data() })); pronto.ignorados = true; recalcular(); },
        (err) => { console.warn("[useCRM] Coleção ignore não encontrada (normal na 1ª vez):", err); pronto.ignorados = true; recalcular(); }
      )
    );

    unsubs.push(
      onSnapshot(
        doc(db, "dadosCRM", empresaId, "radar", "risco"),
        (snap) => { buffer.radar = snap.exists() ? snap.data() : {}; pronto.radar = true; recalcular(); },
        (err) => { console.warn("[useCRM] Config radar não encontrada (usando padrão):", err); buffer.radar = {}; pronto.radar = true; recalcular(); }
      )
    );

    return () => unsubs.forEach((u) => u());
  }, [empresaId]);

  return estado;
}

// ─── Templates de mensagem (sem IA) ──────────────────────────────────────────
// variacaoIdx permite ciclar entre templates para o botão "Nova variação"
export function gerarMensagemTemplate(insight, empresaNome, variacaoIdx = 0) {
  const nome1   = (insight.cliente || "você").split(" ")[0];
  const produto = insight.produtoFavorito || null;
  const servico = insight.servico || null;

  if (insight.tipo === "risco") {
    const templates = produto
      ? [
          `Oi ${nome1}! Lembrei de você organizando a agenda aqui. Já faz um tempo que não te vejo — quando dá pra passar?`,
          `Ei ${nome1}! Tava vendo aqui e senti sua falta. Aquele(a) ${produto} tá precisando de você! Quando aparece?`,
          `Oi ${nome1}! Passando rapidinho pra dar um oi. Como tá? Quando a gente consegue marcar?`,
          `Oi ${nome1}! Você sumiu! Tudo certo por aí? Quando passa por aqui de novo?`,
          `Oi ${nome1}! Lembrei de você agora. Já na hora de um novo ${produto}? Quando posso te esperar?`,
        ]
      : [
          `Oi ${nome1}! Lembrei de você organizando a agenda aqui. Faz um tempo que não te vejo — tudo bem?`,
          `Ei ${nome1}! Passando pra dar um oi. Você sumiu! Como tão as coisas? Quando a gente se vê?`,
          `Oi ${nome1}! Tava vendo minha lista e senti sua falta. Quando consegue aparecer por aqui?`,
          `Oi ${nome1}! Tudo bem com você? Faz um tempão — quando a gente consegue marcar algo?`,
          `Oi ${nome1}! Passando rapidinho. Como tá? Quando consigo te ver por aqui de novo?`,
        ];
    return templates[variacaoIdx % templates.length];
  }

  if (insight.tipo === "oportunidade") {
    const templates = servico && produto
      ? [
          `Oi ${nome1}! Quem faz ${produto} direitinho costuma amar o(a) ${servico} — pode ser o próximo passo certo pra você. Quer saber mais?`,
          `Oi ${nome1}! Tenho uma novidade que combina perfeitamente com o que você já faz aqui. Posso te contar rapidinho?`,
          `Oi ${nome1}! Pensando no seu trabalho com ${produto}, acho que o(a) ${servico} pode levar os resultados ainda mais longe. Quando conversa?`,
          `Oi ${nome1}! Uma coisa que quero muito te mostrar: o(a) ${servico}. Complementa demais o que você já faz. Posso te explicar?`,
        ]
      : [
          `Oi ${nome1}! Tenho uma novidade que acho que vai te interessar. Posso te contar rapidinho?`,
          `Oi ${nome1}! Lembrei de você quando vi algo que combina muito com o que você já faz por aqui. Quando conversa?`,
          `Oi ${nome1}! Tenho algo novo que pode ser o próximo passo natural pra você. Quer saber?`,
        ];
    return templates[variacaoIdx % templates.length];
  }

  return `Oi ${nome1}! Passando pra dar um oi. Como você tá?`;
}
