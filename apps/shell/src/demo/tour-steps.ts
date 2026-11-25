import type { TourStep } from './tour-runner';

// Fixed ids from @oakestra/mocks (fixtures/backend.json): test-cluster reports in the demo, and
// mlbatch belongs to Admin, the demo user, so its detail page opens.
const TEST_CLUSTER_ID = '6a6d268f0908db5abba33b10';
const MLBATCH_APPLICATION_ID = '6ae75bea77578493c2f80311';

/**
 * Targets are `data-testid`s where the page has one and `data-tour` attributes otherwise, so
 * restyling a page does not silently break the tour. The e2e suite keeps the test ids stable.
 */
export const DEMO_TOUR_STEPS: readonly TourStep[] = [
  {
    path: '/',
    title: 'Welcome to the Oakestra dashboard',
    description:
      'Oakestra orchestrates containers and unikernels across clusters and edge devices from one root orchestrator. ' +
      'This demo runs in your browser on simulated clusters. You can deploy and delete things, a reload brings everything back.',
  },
  {
    path: '/',
    selector: '[data-testid="overview-summary"]',
    title: 'Overview',
    description:
      'The overview counts your applications, services, instances and clusters. Each tile links to the full list.',
  },
  {
    path: '/',
    selector: '[data-testid="needs-attention"]',
    title: 'Needs attention',
    description: 'Services that failed, cannot be scheduled or are not deployed yet.',
  },
  {
    path: '/fleet',
    selector: 'ul[aria-label="Fleet board"]',
    title: 'Fleet',
    description:
      'The fleet board shows every cluster with the services running on it, grouped by application. Select a service to inspect it.',
  },
  {
    path: '/fleet',
    selector: '[role="group"][aria-label="Unplaced"]',
    title: 'Unplaced services',
    description:
      'Services the scheduler could not place end up here. Select one to see which clusters were ruled out and why.',
  },
  {
    path: `/infrastructure/clusters/${TEST_CLUSTER_ID}`,
    selector: '[data-testid="cluster-stats"]',
    title: 'A cluster',
    description:
      'Each cluster reports CPU and memory usage and its active worker nodes. The figures are sums over all of its workers.',
  },
  {
    path: `/infrastructure/clusters/${TEST_CLUSTER_ID}`,
    selector: '[data-tour="cluster-widget-carbon-energy"]',
    title: 'Addons extend core pages',
    description:
      'The Energy card comes from the Carbon & Energy addon, which adds it to every cluster page.',
  },
  {
    path: `/applications/${MLBATCH_APPLICATION_ID}`,
    selector: '[data-tour="application-services"]',
    title: 'An application',
    description:
      'An application groups services. Open a service to see its instances, logs and where the scheduler placed it.',
  },
  {
    selector: '[data-tour="nav-group-addons"]',
    title: 'Addons',
    description:
      'Example and Carbon & Energy are addons. The dashboard loads their code at runtime with Module Federation.',
    side: 'right',
  },
  {
    path: '/addon-manager/marketplace',
    selector: '[data-testid="marketplace-card-flops"]',
    title: 'Install an addon',
    description:
      'Try installing FLOps. A few seconds later it appears under Addons in the sidebar and adds a Federated learning tab to the mlbatch application.',
  },
  {
    selector: '[data-testid="command-palette-trigger"]',
    title: 'Find anything',
    description:
      'Press Ctrl+K (Cmd+K on a Mac) to jump to any page, application or cluster, or to run an action. You can restart this tour from the bar at the top.',
  },
];
