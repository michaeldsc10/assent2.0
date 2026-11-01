/* ═══════════════════════════════════════════════════
   ASSENT - Registro de tutoriais
   ─────────────────────────────────────────────────
   Para criar o tutorial de um módulo:
   1) Adicione uma entrada em TOURS (id, version, steps)
   2) Mapeie o nome do módulo em TOUR_POR_MODULO
   3) Marque os elementos no módulo com data-tour="id-do-alvo"
   Nada mais muda no Dashboard.

   Campos do step:
   - target  : valor do data-tour do elemento (omitir = card centralizado)
   - title   : título curto
   - body    : texto curto
   - side    : lado preferido do card (top | bottom | left | right)
   - when    : (ctx) => boolean, passo só entra se verdadeiro
   - onEnter : (ctx) => void, prepara a tela antes de mostrar o passo
   Suba "version" para o tutorial aparecer de novo para todos.
   ═══════════════════════════════════════════════════ */

const verVisaoGeral = (ctx) => ctx?.setDashView?.("overview");

export const TOURS = {
  dashboard: {
    version: 1,
    steps: [
      {
        title: "Bem-vindo ao Assent",
        body: "Um guia rápido pelo seu painel. Você pode pular quando quiser e rever depois pelo ícone de informação no topo.",
      },
      {
        target: "perfil",
        side: "bottom",
        title: "Seu perfil",
        body: "Clique no seu nome para abrir o menu. Em Configurações você ajusta seus dados, sua foto e as informações da empresa.",
      },
      {
        target: "periodo",
        side: "bottom",
        title: "Período dos dados",
        body: "Escolha o intervalo que deseja analisar. Todos os valores do painel se atualizam automaticamente.",
        onEnter: verVisaoGeral,
      },
      {
        target: "kpi-receita",
        side: "bottom",
        title: "Receita bruta",
        body: "Soma de todas as vendas do período, antes de descontar os custos.",
        onEnter: verVisaoGeral,
      },
      {
        target: "kpi-despesa",
        side: "bottom",
        title: "Despesa total",
        body: "Custo das mercadorias e serviços vendidos no período.",
        onEnter: verVisaoGeral,
      },
      {
        target: "kpi-lucro",
        side: "bottom",
        title: "Lucro líquido",
        body: "Receita menos custos. A margem em porcentagem aparece logo abaixo do valor.",
        onEnter: verVisaoGeral,
      },
      {
        target: "kpi-areceber",
        side: "bottom",
        title: "A receber",
        body: "Valores que seus clientes ainda vão pagar, como fiado e vendas a prazo.",
        onEnter: verVisaoGeral,
      },
      {
        target: "agenda-financeira",
        side: "top",
        title: "Agenda financeira",
        body: "Calendário do mês com despesas a pagar e valores a receber. Clique em um dia para ver os detalhes.",
        onEnter: verVisaoGeral,
      },
      {
        target: "dash-view",
        side: "bottom",
        title: "Visão geral e gráficos",
        body: "Alterne entre os números do dia a dia e os gráficos de evolução do seu negócio.",
      },
      {
        target: "tour-info",
        side: "bottom",
        title: "Precisa rever?",
        body: "Clique neste ícone sempre que quiser abrir este guia novamente.",
      },
    ],
  },

  /* Módulos: adicione aqui depois. Exemplo:
  clientes: {
    version: 1,
    steps: [
      { target: "cl-novo", title: "Novo cliente", body: "..." },
    ],
  },
  */
};

/* Nome do módulo no Dashboard (estado `module`) -> id do tour */
export const TOUR_POR_MODULO = {
  Dashboard: "dashboard",
  // Clientes: "clientes",
};

export const getTour = (id) => (id && TOURS[id]) || null;
export const tourDoModulo = (modulo) => TOUR_POR_MODULO[modulo] || null;
