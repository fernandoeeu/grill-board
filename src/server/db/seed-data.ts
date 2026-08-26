import type { AnsweredVia, QuestionStatus } from "@/lib/types";

/** A round as declared by the seed: only its number, ids are generated at insert time. */
export interface SeedRound {
  number: number;
}

/** A question as declared by the seed: short id plus the round number it belongs to. */
export interface SeedQuestion {
  id: string;
  round: number;
  category: string;
  status: QuestionStatus;
  text: string;
  recommendation?: string;
  options?: string[];
  note?: string;
  answer?: string;
  answeredVia?: AnsweredVia;
}

/** The raw shape of a seed topic, before it becomes rows in the database. */
export interface SeedTopic {
  id: string;
  title: string;
  context: string;
  categories: string[];
  rounds: SeedRound[];
  questions: SeedQuestion[];
}

export const seedTopic: SeedTopic = {
  id: "ephemeral-preview-envs",
  title: "Ambientes de staging/preview efêmeros + git flow — dudata-hub",
  context:
    "Feature branches a partir de main; previews efêmeros por PR em vez de staging fixo; sem branch de staging, sem deploy train",
  categories: ["Git flow", "Ciclo de vida do ambiente", "Dados e credenciais", "Governança"],
  rounds: [{ number: 1 }, { number: 2 }],
  questions: [
    {
      id: "q1",
      round: 1,
      category: "Git flow",
      status: "answered",
      text: 'Staging/preview é ambiente, não branch? Git flow intocado: feature branch de main, 1 PR só; "abrir para staging" = apontar um ambiente para o SHA da branch.',
      recommendation: "Sim — nenhuma branch nova, nenhum merge novo, zero conflito/rebase novo.",
      answer: "Sim, ambiente sem branch — git flow intocado (feature branch de main, 1 PR).",
      answeredVia: "chat",
    },
    {
      id: "q7",
      round: 1,
      category: "Git flow",
      status: "answered",
      text: "Se os previews efêmeros se provarem viáveis, ainda existe um staging FIXO além deles (URL estável para demo, dados que sobrevivem à semana)?",
      recommendation:
        'Só previews; prod promovido de main como hoje. O caso "demo com URL estável" morre junto — decisão sua.',
      answer: "Só previews — nenhum staging fixo; prod promovido de main como hoje.",
      answeredVia: "chat",
    },
    {
      id: "q2",
      round: 1,
      category: "Ciclo de vida do ambiente",
      status: "answered",
      text: "O que dispara e mantém o ambiente efêmero?",
      answer: "Label no PR = ambiente vivo; remover label ou fechar PR = teardown.",
      answeredVia: "chat",
    },
    {
      id: "q3",
      round: 1,
      category: "Ciclo de vida do ambiente",
      status: "suspended",
      text: "Contenção do staging compartilhado (duas features ao mesmo tempo, last-write-wins?)",
      note: "Obsoleta se o modelo for preview efêmero por PR.",
    },
    {
      id: "q4",
      round: 1,
      category: "Ciclo de vida do ambiente",
      status: "suspended",
      text: "O que o staging mostra quando ocioso (segue main ou fica no último deploy)?",
      note: "Obsoleta se o modelo for preview efêmero por PR.",
    },
    {
      id: "q5",
      round: 1,
      category: "Dados e credenciais",
      status: "answered",
      text: "Dado de preview é 100% descartável? Seed sintético, reset (wipe + re-seed) livre, nada precioso.",
      recommendation: "Sim — seedAll já faz wipe total; perfeito para efêmero.",
      answer: "Sim, dado 100% descartável — seed sintético, reset livre.",
      answeredVia: "chat",
    },
    {
      id: "q8",
      round: 2,
      category: "Dados e credenciais",
      status: "pending_facts",
      text: "O painel de ambientes no hub mostra a senha do preview, ou só o comando para derivá-la localmente?",
      note: "Aguardando relatórios dos agentes de pesquisa (cred-delivery) para virar pergunta aberta.",
    },
    {
      id: "q6",
      round: 1,
      category: "Governança",
      status: "answered",
      text: "Deploy e teardown de preview são passos [AGENTE-OK] (agente dispara livremente, sem a cerimônia de prod)?",
      recommendation:
        "Sim — a cerimônia (manifest, proveniência, [HUMANO]) continua exclusiva de prod.",
      options: ["Sim, AGENTE-OK", "Não, quero aprovar cada deploy"],
      answer: "Sim, [AGENTE-OK] — deploy/teardown de preview sem cerimônia de prod.",
      answeredVia: "chat",
    },
  ],
};
