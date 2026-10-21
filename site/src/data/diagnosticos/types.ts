// Tipos das landing pages de diagnóstico (quiz). Cada LP é só um arquivo de configuração
// desta pasta; o motor (src/lib/diagnostico.ts) e o componente DiagnosticQuiz.astro são únicos.
// Tudo aqui precisa ser serializável em JSON: a configuração vai inteira para o navegador.

export type Cor = 'verde' | 'amarelo' | 'vermelho';
export type Temperatura = 'quente' | 'frio';

/** Condição sobre as respostas. `q` é o id da pergunta; `in` lista os valores aceites. */
export type Condicao =
  | { q: string; in: string[] }
  | { q: string; notIn: string[] }
  | { all: Condicao[] }
  | { any: Condicao[] };

export interface Opcao { valor: string; texto: string; }

export interface Pergunta {
  id: string;
  texto: string;
  ajuda?: string;
  opcoes: Opcao[];
  /** A pergunta só aparece quando a condição é verdadeira (lógica condicional). */
  showIf?: Condicao;
}

export interface Resultado {
  /** Id interno da regra (vai para o CRM). */
  id: string;
  cor: Cor;
  /** Serviço recomendado (o que vendemos). */
  servico: string;
  /** O QUE a pessoa tem. Nunca o passo a passo de como resolver. */
  descricao: string;
  /** Substitui o título padrão do semáforo (ex.: "Sua carta já é reconhecida em Portugal"). */
  titulo?: string;
  /** Força a temperatura do lead (ex.: sem perfil → nutrição). */
  temperatura?: Temperatura;
}

export interface Regra extends Resultado {
  quando: Condicao;
  /** Maior = mais importante. A regra principal é a de maior prioridade que se aplica. */
  prioridade: number;
}

export interface Textos { titulo: string; subtitulo: string; botao: string; }

export interface ConfigTemperatura {
  /** Pontos pela cor do resultado principal. */
  porCor: Partial<Record<Cor, number>>;
  /** Pontos extra por resposta. */
  pontos: { quando: Condicao; pontos: number }[];
  /** A partir desta soma o lead é "quente". */
  quenteAPartirDe: number;
}

export interface Diagnostico {
  slug: string;
  /** false = rascunho: não é gerado no build de produção (404). */
  publicado: boolean;
  /** Nome curto usado no WhatsApp e no CRM ("Situação em Portugal"). */
  nome: string;
  /** Título da aba do navegador e descrição (as LPs são noindex). */
  seo: { title: string; description: string };
  /** Variante A sempre; variante B opcional, ativada com ?v=b. */
  textos: { a: Textos; b?: Textos };
  perguntas: Pergunta[];
  regras: Regra[];
  /** Resultado quando nenhuma regra se aplica. */
  semPerfil: Resultado;
  /** Lead marcado high_ticket quando esta condição é verdadeira (e fica sempre quente). */
  highTicket?: Condicao;
  temperatura: ConfigTemperatura;
  /** Rodapé jurídico extra (ex.: página publicada em nome do advogado parceiro). */
  rodapeJuridico?: string;
}
