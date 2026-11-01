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
   - mobile  : { title, body, side } sobrescreve o passo em telas até 720px
   - when    : (ctx) => boolean, passo só entra se verdadeiro
   - onEnter : (ctx) => void, prepara a tela antes de mostrar o passo
   Suba "version" para o tutorial aparecer de novo para todos.
   ═══════════════════════════════════════════════════ */

const verVisaoGeral = (ctx) => ctx?.setDashView?.("overview");

/* Clica em um alvo visível (ex.: trocar de aba antes de explicar o conteúdo) */
const clicarAlvo = (id) => {
  try {
    const nodes = document.querySelectorAll(`[data-tour="${CSS.escape(id)}"]`);
    for (const el of nodes) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) { el.click(); return; }
    }
  } catch { /* noop */ }
};
const clicar = (id) => () => clicarAlvo(id);

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
        target: "cadastros",
        side: "left",
        title: "Cadastros",
        body: "Resumo de clientes, produtos e serviços cadastrados, e vendas do período. Clique em uma linha para abrir o módulo.",
        onEnter: verVisaoGeral,
      },
      {
        target: "despesas-resumo",
        side: "left",
        title: "Controle de despesas",
        body: "Veja de relance o que está vencido, a vencer, pendente e já pago. Use Ver todas para gerenciar.",
        onEnter: verVisaoGeral,
      },
      {
        target: "dash-view",
        side: "bottom",
        title: "Visão geral e gráficos",
        body: "Alterne entre os números do dia a dia e os gráficos de evolução do seu negócio.",
      },
      {
        target: "menu",
        side: "right",
        title: "Menu de módulos",
        body: "Aqui ficam todos os módulos, agrupados em Básico, Operações, Análise e Sistema. Cada módulo terá o seu próprio guia.",
        mobile: {
          side: "top",
          body: "Toque em Menu para ver todos os módulos, agrupados em Básico, Operações, Análise e Sistema.",
        },
      },
      {
        target: "tour-info",
        side: "bottom",
        title: "Precisa rever?",
        body: "Clique neste ícone sempre que quiser abrir este guia novamente.",
      },
    ],
  },

  /* ── Módulos ───────────────────────────────── */

  clientes: {
    version: 1,
    steps: [
      { title: "Clientes", body: "Sua base de clientes. Veja como cadastrar, buscar e consultar o histórico." },
      { target: "cl-busca", side: "bottom", title: "Busca", body: "Procure por nome, CPF ou telefone. A lista filtra enquanto você digita." },
      { target: "cl-novo", side: "bottom", title: "Novo cliente", body: "Cadastre um cliente. Atalho rápido: tecla N." },
      { target: "cl-tabela", side: "top", title: "Lista de clientes", body: "Clique em um nome para ver o histórico de compras. ID e Nome ordenam a lista. Os ícones de cada linha editam ou excluem." },
    ],
  },

  servicos: {
    version: 1,
    steps: [
      { title: "Serviços", body: "O catálogo do que você oferece, com preço, custo e margem." },
      { target: "sv-busca", side: "bottom", title: "Busca", body: "Procure por nome ou categoria." },
      { target: "sv-categorias", side: "bottom", title: "Categorias", body: "Organize seus serviços em grupos para encontrar tudo mais rápido." },
      { target: "sv-novo", side: "bottom", title: "Novo serviço", body: "Cadastre um serviço. Atalho rápido: tecla N." },
      { target: "sv-tabela", side: "top", title: "Catálogo", body: "Veja preço, custo e margem de cada serviço. Use os ícones da linha para editar ou excluir." },
    ],
  },

  alunos: {
    version: 1,
    steps: [
      { title: "Alunos", body: "Cadastro pessoal dos alunos, separado de Clientes." },
      { target: "al-busca", side: "bottom", title: "Busca", body: "Procure por nome, documento ou ID." },
      { target: "al-novo", side: "bottom", title: "Novo aluno", body: "Cadastre um aluno. A matrícula é feita no módulo Mensalidades." },
      { target: "al-tabela", side: "top", title: "Lista de alunos", body: "Clique em um aluno para ver os detalhes. A coluna Matrícula mostra quem já está matriculado." },
    ],
  },

  mensalidades: {
    version: 1,
    steps: [
      { title: "Mensalidades", body: "Gestão de alunos, mensalidades e cobrança em um só lugar." },
      { target: "mat-config", side: "bottom", title: "Configurações", body: "Ajustes do módulo, como as turmas." },
      { target: "mat-nova", side: "bottom", title: "Nova matrícula", body: "Matricule um aluno para acompanhar as mensalidades dele." },
      { target: "mat-cards", side: "bottom", title: "Resumo", body: "Total de alunos ativos, quantos estão em dia e quantos estão vencendo ou vencidos." },
      { target: "mat-filtros", side: "bottom", title: "Busca e filtros", body: "Filtre por status ou turma. Os botões de filtro rápido mostram pendentes e vencidos." },
      { target: "mat-tabela", side: "top", title: "Alunos matriculados", body: "Acompanhe a situação de cada aluno. Clique no nome da coluna para ordenar." },
    ],
  },

  areceber: {
    version: 1,
    steps: [
      { title: "A Receber", body: "Controle das contas e valores pendentes dos seus clientes." },
      { target: "ar-busca", side: "bottom", title: "Busca", body: "Procure por cliente ou descrição." },
      { target: "ar-filtros", side: "bottom", title: "Filtro por status", body: "Veja só o que está pendente, vencido ou pago." },
      { target: "ar-periodo", side: "bottom", title: "Período", body: "Escolha o intervalo de vencimento que deseja analisar." },
      { target: "ar-nova", side: "bottom", title: "Nova conta", body: "Lance um valor a receber. Atalho rápido: tecla N." },
      { target: "ar-wpp", side: "bottom", title: "Mensagem de cobrança", body: "Edite o texto padrão enviado aos clientes pelo WhatsApp." },
      { target: "ar-kpis", side: "bottom", title: "Resumo", body: "Total a receber, valor vencido e total já recebido." },
      { target: "ar-tabela", side: "top", title: "Contas", body: "Em cada conta, use o WhatsApp para cobrar e o botão de pagamento para registrar o recebimento. Clique na linha para ver detalhes." },
    ],
  },

  despesas: {
    version: 1,
    steps: [
      { title: "Despesas", body: "Controle de pagamentos e obrigações financeiras." },
      { target: "desp-busca", side: "bottom", title: "Busca", body: "Procure por descrição ou fornecedor." },
      { target: "desp-nova", side: "bottom", title: "Nova despesa", body: "Lance uma despesa. Atalho rápido: tecla N." },
      { target: "desp-metricas", side: "bottom", title: "Resumo clicável", body: "Vencidas, vencem em 3 dias, total pendente e pago no mês. Clique em um card para filtrar a lista." },
      { target: "desp-filtros", side: "bottom", title: "Filtros", body: "Filtre por status, período e categoria. Em Categorias você organiza seus grupos de despesa." },
      { target: "desp-tabela", side: "top", title: "Lista de despesas", body: "Clique em uma despesa para ver os detalhes. O ícone de setas marca despesas recorrentes." },
    ],
  },

  vendas: {
    version: 1,
    steps: [
      { title: "Vendas", body: "Acompanhe e gerencie todas as vendas do seu negócio." },
      { target: "vd-busca", side: "bottom", title: "Busca", body: "Procure por ID da venda ou nome do cliente." },
      { target: "vd-nova", side: "bottom", title: "Nova venda", body: "Registre uma venda. Atalho rápido: tecla N." },
      { target: "vd-abas", side: "bottom", title: "Abas", body: "Vendas, Mesas, PDV e Canceladas. Cada aba lista um tipo de venda." },
      { target: "vd-periodos", side: "bottom", title: "Período", body: "O período vale para todas as abas." },
      { target: "vd-tabela", side: "top", title: "Lista de vendas", body: "Clique em uma venda para ver os detalhes. O botão CSV exporta a lista." },
    ],
  },

  mesas: {
    version: 1,
    steps: [
      { title: "Mesas", body: "Controle as comandas do salão em tempo real." },
      { target: "mesas-config", side: "bottom", title: "Configurar mesas", body: "Adicione e organize as mesas do seu espaço." },
      { target: "mesas-abas", side: "bottom", title: "Mesas e histórico", body: "Mesas mostra o salão agora. Histórico lista os atendimentos anteriores.", onEnter: clicar("mesas-aba-mesas") },
      { target: "mesas-legenda", side: "bottom", title: "Livre ou ocupada", body: "A legenda mostra como identificar o estado de cada mesa.", onEnter: clicar("mesas-aba-mesas") },
      { target: "mesas-grid", side: "top", title: "Salão", body: "Clique em uma mesa para abrir ou gerenciar a comanda. Mesas ocupadas mostram cliente, horário e total.", onEnter: clicar("mesas-aba-mesas") },
    ],
  },

  pdv: {
    version: 1,
    steps: [
      { title: "PDV", body: "Frente de caixa para vender rápido. Veja o caminho de uma venda." },
      { target: "pdv-codigo", side: "bottom", title: "Leitura do produto", body: "Leia o código de barras ou digite o código para adicionar o item.", onEnter: clicar("pdv-tab-produtos") },
      { target: "pdv-busca", side: "bottom", title: "Busca por nome", body: "Sem código? Procure o produto pelo nome.", onEnter: clicar("pdv-tab-produtos") },
      { target: "pdv-cliente", side: "bottom", title: "Cliente", body: "Vincule a venda a um cliente, se quiser. Este campo é opcional.", onEnter: clicar("pdv-tab-produtos") },
      { target: "pdv-pagamento", side: "top", title: "Pagamento", body: "Adicione uma ou mais formas de pagamento. O pagamento pode ser dividido.", onEnter: clicar("pdv-tab-produtos") },
      { target: "pdv-carrinho", side: "bottom", title: "Cupom", body: "Os itens da venda aparecem aqui conforme você adiciona.", onEnter: clicar("pdv-tab-carrinho") },
      { target: "pdv-total", side: "top", title: "Totais", body: "Acompanhe subtotal e quanto já foi pago.", onEnter: clicar("pdv-tab-carrinho") },
      { target: "pdv-finalizar", side: "top", title: "Finalizar", body: "Com o valor pago completo, finalize a venda. Para desistir, use Cancelar venda.", onEnter: clicar("pdv-tab-carrinho") },
    ],
  },

  usuarios: {
    version: 1,
    steps: [
      { title: "Usuários", body: "Gerencie os acessos da sua equipe." },
      { target: "usr-contador", side: "bottom", title: "Limite de acessos", body: "Quantos usuários ativos você tem em relação ao limite do plano." },
      { target: "usr-convidar", side: "bottom", title: "Convidar usuário", body: "Dê acesso a alguém da equipe e defina o cargo dele." },
      { target: "usr-tabela", side: "top", title: "Sua equipe", body: "Você aparece no topo como proprietário. Veja cargo, vendedor vinculado e status de cada pessoa. Desative um acesso para liberar uma vaga." },
    ],
  },
};

/* Nome do módulo no Dashboard (estado `module`) -> id do tour */
export const TOUR_POR_MODULO = {
  Dashboard: "dashboard",
  Clientes: "clientes",
  "Serviços": "servicos",
  Alunos: "alunos",
  Mensalidades: "mensalidades",
  "A Receber": "areceber",
  Despesas: "despesas",
  Vendas: "vendas",
  Mesas: "mesas",
  PDV: "pdv",
  "Usuários": "usuarios",
};

export const getTour = (id) => (id && TOURS[id]) || null;
export const tourDoModulo = (modulo) => TOUR_POR_MODULO[modulo] || null;
