export type ProjectStatus = 'running' | 'completed' | 'queued' | 'failed';

export interface RoundMetric {
  round: number;
  /** Percent, 0 to 100. */
  accuracy: number;
  loss: number;
  timestamp: Date;
}

export interface Learner {
  id: string;
  /** Name of a cluster of the demo platform. */
  cluster: string;
  samples: number;
  /** Share of the last aggregated round this learner contributed, in percent. */
  lastRoundShare: number;
  lastRound: number;
}

export interface FlProject {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  model: string;
  strategy: 'FedAvg' | 'FedProx';
  roundsDone: number;
  roundsTotal: number;
  learners: Learner[];
  metrics: RoundMetric[];
  /** Name of the Oakestra application the aggregator runs in, when it is one. */
  application?: string;
}

const MINUTE = 60_000;

interface Curve {
  start: number;
  best: number;
  /** Rounds until the curve has covered about two thirds of the way. */
  tau: number;
  startLoss: number;
  startedAt: string;
  roundMinutes: number;
}

// A smooth curve with a small fixed wobble: deterministic, but not a straight line.
function metricsFor(done: number, curve: Curve): RoundMetric[] {
  const startedAt = Date.parse(curve.startedAt);
  return Array.from({ length: done }, (_, index) => {
    const round = index + 1;
    const progress = 1 - Math.exp(-round / curve.tau);
    const wobble = Math.sin(round * 1.7) * 0.35;
    return {
      round,
      accuracy: Math.min(99.5, curve.start + (curve.best - curve.start) * progress + wobble),
      loss: Math.max(0.02, curve.startLoss * Math.exp(-round / curve.tau) + 0.04 + wobble * 0.01),
      timestamp: new Date(startedAt + round * curve.roundMinutes * MINUTE),
    };
  });
}

function learnersFor(
  project: string,
  rows: readonly (readonly [cluster: string, samples: number])[],
  lastRound: number,
): Learner[] {
  const total = rows.reduce((sum, [, samples]) => sum + samples, 0);
  return rows.map(([cluster, samples], index) => ({
    id: `${project}-learner-${index + 1}`,
    cluster,
    samples,
    lastRoundShare: Math.round((samples / total) * 1000) / 10,
    lastRound,
  }));
}

export const PROJECTS: readonly FlProject[] = [
  {
    id: 'anomaly-sensors',
    name: 'Anomaly detection on sensor data',
    description: 'Autoencoder that flags unusual vibration patterns.',
    status: 'running',
    model: 'Autoencoder (1D CNN)',
    strategy: 'FedAvg',
    roundsDone: 18,
    roundsTotal: 30,
    learners: learnersFor(
      'anomaly-sensors',
      [
        ['plant-leipzig', 48_200],
        ['edge-munich', 31_450],
        ['edge-hamburg', 22_900],
        ['edge-wien', 17_300],
      ],
      18,
    ),
    metrics: metricsFor(18, {
      start: 61,
      best: 94.2,
      tau: 7,
      startLoss: 1.1,
      startedAt: '2026-11-24T08:10:00Z',
      roundMinutes: 22,
    }),
  },
  {
    id: 'keyboard-nwp',
    name: 'Next-word keyboard model',
    description: 'Small language model for keyboard suggestions.',
    status: 'running',
    model: 'GRU language model',
    strategy: 'FedProx',
    roundsDone: 41,
    roundsTotal: 100,
    learners: learnersFor(
      'keyboard-nwp',
      [
        ['edge-munich', 92_000],
        ['edge-hamburg', 75_500],
        ['edge-wien', 64_800],
        ['test-cluster', 12_400],
        ['plant-leipzig', 9_100],
      ],
      41,
    ),
    metrics: metricsFor(41, {
      start: 18,
      best: 31.5,
      tau: 16,
      startLoss: 5.6,
      startedAt: '2026-11-23T19:40:00Z',
      roundMinutes: 14,
    }),
  },
  {
    id: 'defect-leipzig',
    name: 'Defect detection plant Leipzig',
    description: 'Visual inspection for the assembly line. The aggregator runs in mlbatch.',
    status: 'completed',
    model: 'MobileNetV3 (small)',
    strategy: 'FedAvg',
    roundsDone: 25,
    roundsTotal: 25,
    learners: learnersFor(
      'defect-leipzig',
      [
        ['plant-leipzig', 36_800],
        ['edge-munich', 14_200],
        ['edge-wien', 11_650],
      ],
      25,
    ),
    metrics: metricsFor(25, {
      start: 72,
      best: 97.1,
      tau: 6,
      startLoss: 0.9,
      startedAt: '2026-11-20T06:00:00Z',
      roundMinutes: 31,
    }),
    application: 'mlbatch',
  },
  {
    id: 'predictive-maintenance',
    name: 'Predictive maintenance for pumps',
    description: 'Gradient-boosted model, waiting for free capacity on the edge clusters.',
    status: 'queued',
    model: 'Gradient boosting',
    strategy: 'FedAvg',
    roundsDone: 0,
    roundsTotal: 40,
    learners: learnersFor(
      'predictive-maintenance',
      [
        ['edge-hamburg', 8_400],
        ['edge-wien', 6_900],
      ],
      0,
    ),
    metrics: [],
  },
  {
    id: 'traffic-forecast',
    name: 'Traffic flow forecasting',
    description: 'Stopped: a learner lost its connection and too few were left for a round.',
    status: 'failed',
    model: 'Temporal convolution',
    strategy: 'FedProx',
    roundsDone: 9,
    roundsTotal: 50,
    learners: learnersFor(
      'traffic-forecast',
      [
        ['edge-munich', 27_300],
        ['edge-hamburg', 25_100],
        ['test-cluster', 4_200],
      ],
      9,
    ),
    metrics: metricsFor(9, {
      start: 54,
      best: 71,
      tau: 8,
      startLoss: 1.4,
      startedAt: '2026-11-22T13:15:00Z',
      roundMinutes: 18,
    }),
  },
];

export function findProject(id: string | undefined): FlProject | undefined {
  return PROJECTS.find((project) => project.id === id);
}

export function projectForApplication(applicationName: string): FlProject | undefined {
  return PROJECTS.find((project) => project.application === applicationName);
}

export function latestMetric(project: FlProject): RoundMetric | undefined {
  return project.metrics.at(-1);
}

export function bestAccuracy(projects: readonly FlProject[]): number | undefined {
  const values = projects.flatMap((project) => project.metrics.map((metric) => metric.accuracy));
  return values.length > 0 ? Math.max(...values) : undefined;
}
