// Option lists and the exercise library. Copy (pt-BR) is final per the design handoff.

export const GOALS = [
  'Melhorar condicionamento', 'Começar a correr', 'Correr 5 km', 'Correr 10 km',
  'Aumentar distância', 'Melhorar pace', 'Emagrecimento', 'Ganho de força',
  'Ganho de massa muscular', 'Melhorar mobilidade', 'Criar rotina', 'Combinar força + cardio',
] as const;

export const STRENGTH_LEVELS = ['Nunca treinei', 'Iniciante', 'Intermediário', 'Avançado'] as const;

/** [chip label, full name], index = weekday (0 = Domingo). */
export const DAY_LABELS: [string, string][] = [
  ['D', 'Domingo'], ['S', 'Segunda'], ['T', 'Terça'], ['Q', 'Quarta'],
  ['Q', 'Quinta'], ['S', 'Sexta'], ['S', 'Sábado'],
];

export const DURATIONS = ['15 min', '30 min', '45 min', '60 min', '90+ min'] as const;
export const LOCATIONS = ['Casa', 'Academia', 'Ao ar livre'] as const;
export const EQUIPMENT = ['Nenhum', 'Halteres', 'Elásticos', 'Barra fixa', 'Máquinas', 'Barras/pesos', 'Outros'] as const;

export function durationMinutes(d: string | null | undefined): number {
  if (!d) return 45;
  const n = parseInt(d, 10);
  return Number.isFinite(n) ? n : 45;
}

export interface Exercise {
  id: string;
  name: string;
  /** English name used to look the GIF up on ExerciseDB when gifUrl is absent. */
  apiQuery: string;
  /** Verified static GIF (ExerciseDB / AscendAPI). */
  gifUrl?: string;
  category: 'Calistenia' | 'Academia' | 'Halteres' | 'Elásticos';
  movement: string;
  desc: string;
  primary: string;
  secondary: string;
  progression: string[];
  /** Exercise is available if the user has ANY of these (empty = bodyweight). */
  requires: string[];
}

export const EXERCISES: Exercise[] = [
  { id: 'flexao', name: 'Flexão', apiQuery: 'push up', gifUrl: 'https://static.exercisedb.dev/media/B1EVP9F.gif',
    category: 'Calistenia', movement: 'Empurrar horizontal',
    desc: 'Mantenha o corpo reto da cabeça aos calcanhares. Desça até o peito quase tocar o chão e empurre de volta.',
    primary: 'Peitoral', secondary: 'Tríceps, deltoide anterior, core',
    progression: ['Flexão na parede', 'Flexão inclinada', 'Flexão com joelhos', 'Flexão tradicional', 'Flexão fechada', 'Flexão declinada'],
    requires: [] },
  { id: 'agachamento', name: 'Agachamento', apiQuery: 'squat', gifUrl: 'https://static.exercisedb.dev/media/6YUfHPL.gif',
    category: 'Calistenia', movement: 'Agachar',
    desc: 'Pés na largura dos ombros. Desça flexionando quadril e joelhos mantendo o peito erguido.',
    primary: 'Quadríceps', secondary: 'Glúteos, posterior de coxa, core',
    progression: ['Agachamento na cadeira', 'Agachamento assistido', 'Agachamento livre', 'Agachamento búlgaro', 'Pistol squat assistido'],
    requires: [] },
  { id: 'remada', name: 'Remada curvada', apiQuery: 'bent over row', gifUrl: 'https://static.exercisedb.dev/media/eZyBC3j.gif',
    category: 'Academia', movement: 'Puxar horizontal',
    desc: 'Tronco inclinado à frente, puxe a barra em direção ao abdômen mantendo as costas retas.',
    primary: 'Dorsal', secondary: 'Bíceps, trapézio, deltoide posterior',
    progression: ['Remada com elástico', 'Remada unilateral', 'Remada curvada livre', 'Remada pendlay'],
    requires: ['Halteres', 'Elásticos', 'Barras/pesos', 'Máquinas'] },
  { id: 'prancha', name: 'Prancha', apiQuery: 'plank', gifUrl: 'https://static.exercisedb.dev/media/CosupLu.gif',
    category: 'Calistenia', movement: 'Estabilização de core',
    desc: 'Apoie antebraços e pontas dos pés. Mantenha o corpo alinhado sem deixar o quadril cair.',
    primary: 'Core', secondary: 'Ombros, glúteos',
    progression: ['Prancha com joelhos', 'Prancha padrão', 'Prancha com elevação de perna', 'Prancha com toque de ombro'],
    requires: [] },
  // The entries below have no curated gifUrl: the app looks the GIF up on ExerciseDB
  // by `apiQuery` on first view and caches the result.
  { id: 'afundo', name: 'Afundo', apiQuery: 'lunge',
    category: 'Calistenia', movement: 'Agachar unilateral',
    desc: 'Dê um passo à frente e desça até os dois joelhos formarem 90°. Empurre o chão com o pé da frente para voltar.',
    primary: 'Quadríceps', secondary: 'Glúteos, posterior de coxa',
    progression: ['Afundo estático', 'Afundo alternado', 'Afundo reverso', 'Afundo com halteres', 'Afundo com salto'],
    requires: [] },
  { id: 'ponte', name: 'Ponte de glúteo', apiQuery: 'glute bridge',
    category: 'Calistenia', movement: 'Extensão de quadril',
    desc: 'Deitado, joelhos flexionados. Eleve o quadril contraindo os glúteos até alinhar ombros, quadril e joelhos.',
    primary: 'Glúteos', secondary: 'Posterior de coxa, core',
    progression: ['Ponte bilateral', 'Ponte com pausa', 'Ponte unilateral', 'Hip thrust com carga'],
    requires: [] },
  { id: 'escalador', name: 'Escalador', apiQuery: 'mountain climber',
    category: 'Calistenia', movement: 'Core dinâmico',
    desc: 'Em posição de prancha alta, leve os joelhos alternadamente em direção ao peito mantendo o quadril estável.',
    primary: 'Core', secondary: 'Ombros, flexores do quadril',
    progression: ['Escalador lento', 'Escalador ritmado', 'Escalador cruzado', 'Escalador com pausa'],
    requires: [] },
  { id: 'desenvolvimento', name: 'Desenvolvimento', apiQuery: 'dumbbell shoulder press',
    category: 'Halteres', movement: 'Empurrar vertical',
    desc: 'Halteres na altura dos ombros. Empurre acima da cabeça sem arquear a lombar e desça controlando.',
    primary: 'Deltoides', secondary: 'Tríceps, trapézio, core',
    progression: ['Desenvolvimento sentado', 'Desenvolvimento em pé', 'Desenvolvimento unilateral', 'Push press'],
    requires: ['Halteres', 'Barras/pesos', 'Máquinas'] },
  { id: 'barra', name: 'Barra fixa', apiQuery: 'pull up',
    category: 'Calistenia', movement: 'Puxar vertical',
    desc: 'Pegada pronada um pouco além dos ombros. Puxe até o queixo passar a barra e desça até estender os braços.',
    primary: 'Dorsal', secondary: 'Bíceps, romboides, core',
    progression: ['Suspensão na barra', 'Barra negativa', 'Barra com elástico', 'Barra fixa', 'Barra com carga'],
    requires: ['Barra fixa'] },
  { id: 'rosca', name: 'Rosca direta', apiQuery: 'dumbbell biceps curl',
    category: 'Halteres', movement: 'Flexão de cotovelo',
    desc: 'Cotovelos junto ao corpo. Flexione os braços levando os halteres aos ombros e desça devagar.',
    primary: 'Bíceps', secondary: 'Antebraços',
    progression: ['Rosca com elástico', 'Rosca alternada', 'Rosca simultânea', 'Rosca martelo com pausa'],
    requires: ['Halteres', 'Elásticos', 'Barras/pesos', 'Máquinas'] },
];

export function exerciseById(id: string): Exercise | undefined {
  return EXERCISES.find((e) => e.id === id);
}

export function availableExercises(equipment: string[]): Exercise[] {
  return EXERCISES.filter((e) => e.requires.length === 0 || e.requires.some((r) => equipment.includes(r)));
}

/** Current rung on an exercise's progression ladder, derived from the declared strength level. */
export function progressionLevel(ex: Exercise, strengthLevel: string | null): number {
  const idx = Math.max(0, STRENGTH_LEVELS.indexOf((strengthLevel ?? 'Iniciante') as (typeof STRENGTH_LEVELS)[number]));
  const ratio = [0, 0.3, 0.55, 0.8][idx] ?? 0.3;
  return Math.min(ex.progression.length - 1, Math.round(ratio * (ex.progression.length - 1)));
}
