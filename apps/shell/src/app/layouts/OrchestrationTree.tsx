/**
 * The login panel's drawing: Oakestra's actual hierarchy, a root orchestrator, its clusters and
 * their workers, branching downwards like the roots in the logo. It shows no live state, so nothing
 * in it uses a status color.
 */

const WIDTH = 520;
const TIERS = { root: 56, cluster: 216, worker: 392 } as const;
const LABEL_X = 0;
const TREE_LEFT = 104;
const TREE_RIGHT = WIDTH - 8;

/** Workers per cluster. */
const CLUSTERS: readonly number[] = [3, 2, 4];

const WORKER_GAP = (TREE_RIGHT - TREE_LEFT) / (CLUSTERS.reduce((sum, n) => sum + n, 0) - 1);
const ROOT_X = (TREE_LEFT + TREE_RIGHT) / 2;

interface Branch {
  x: number;
  workers: readonly number[];
}

const BRANCHES: readonly Branch[] = (() => {
  let next = 0;
  return CLUSTERS.map((count) => {
    const workers = Array.from({ length: count }, (_, i) => TREE_LEFT + (next + i) * WORKER_GAP);
    next += count;
    return { x: (workers[0]! + workers[count - 1]!) / 2, workers };
  });
})();

/** A vertical S-curve between two tiers. */
function link(x1: number, y1: number, x2: number, y2: number): string {
  const middle = (y1 + y2) / 2;
  return `M${x1} ${y1} C${x1} ${middle} ${x2} ${middle} ${x2} ${y2}`;
}

const TIER_LABELS = [
  { y: TIERS.root, label: 'Root orchestrator' },
  { y: TIERS.cluster, label: 'Clusters' },
  { y: TIERS.worker, label: 'Workers' },
];

export function OrchestrationTree({ className }: { className?: string }) {
  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${TIERS.worker + 24}`}
      className={className}
      role="img"
      aria-label="A root orchestrator connected to three clusters, each with several workers"
    >
      <g fill="none" stroke="currentColor" strokeOpacity={0.38} strokeWidth={1.25}>
        {BRANCHES.map((branch) => (
          <g key={branch.x}>
            <path
              className="oak-tree-link"
              pathLength={1}
              d={link(ROOT_X, TIERS.root, branch.x, TIERS.cluster)}
            />
            {branch.workers.map((x) => (
              <path
                key={x}
                className="oak-tree-link oak-tree-link-late"
                pathLength={1}
                d={link(branch.x, TIERS.cluster, x, TIERS.worker)}
              />
            ))}
          </g>
        ))}
      </g>

      <circle cx={ROOT_X} cy={TIERS.root} r={15} className="fill-sidebar" stroke="currentColor" />
      <circle cx={ROOT_X} cy={TIERS.root} r={7} className="fill-sidebar-primary" />
      {BRANCHES.map((branch) => (
        <g key={branch.x}>
          <circle
            cx={branch.x}
            cy={TIERS.cluster}
            r={8}
            className="fill-sidebar"
            stroke="currentColor"
          />
          <circle cx={branch.x} cy={TIERS.cluster} r={3.5} className="fill-sidebar-primary" />
          {branch.workers.map((x) => (
            <rect
              key={x}
              x={x - 5}
              y={TIERS.worker - 5}
              width={10}
              height={10}
              rx={1.5}
              className="fill-sidebar"
              stroke="currentColor"
            />
          ))}
        </g>
      ))}

      {TIER_LABELS.map(({ y, label }) => (
        <text
          key={label}
          x={LABEL_X}
          y={y}
          dominantBaseline="middle"
          className="fill-current text-[0.75rem] opacity-70"
        >
          {label}
        </text>
      ))}
    </svg>
  );
}
