import { Button } from '@oakestra/ui';
import { ExternalLinkIcon, RouteIcon } from 'lucide-react';
import { useCallback, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { readFlag, TOUR_SEEN_KEY, writeFlag } from './storage';
import type { TourRunner } from './tour-runner';

export const REPOSITORY_URL = 'https://github.com/oakestra/dashboard-v2';

/**
 * Strip at the top of the page panel in the static demo: says what this is, starts the guided
 * tour, links to the code. The tour starts by itself on the first visit after login.
 */
export function DemoBar() {
  const navigate = useNavigate();
  const location = useLocation();
  // The runner asks for the current path long after this render, so it reads a ref.
  // Includes the query, because a step's path may carry one (`/applications?view=clusters`) and
  // the runner compares the two as plain strings.
  const currentPath = location.pathname + location.search;
  const pathRef = useRef(currentPath);
  useEffect(() => {
    pathRef.current = currentPath;
  }, [currentPath]);
  const runnerRef = useRef<TourRunner | null>(null);
  const mountedRef = useRef(false);

  const startTour = useCallback(async () => {
    // driver.js and its stylesheet load only when someone takes the tour.
    const { startDemoTour } = await import('./start-tour');
    if (!mountedRef.current) return;
    runnerRef.current?.stop();
    runnerRef.current = startDemoTour({
      navigate: (path) => navigate(path),
      currentPath: () => pathRef.current,
    });
  }, [navigate]);

  useEffect(() => {
    if (readFlag(TOUR_SEEN_KEY)) return;
    // Written before starting, so StrictMode's second effect run does not start a second tour.
    writeFlag(TOUR_SEEN_KEY);
    void startTour();
  }, [startTour]);

  // Logging out unmounts the layout; a tour left running would point at pages that are gone.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      runnerRef.current?.stop();
    };
  }, []);

  return (
    <div
      data-oakestra-demo="bar"
      className="bg-muted/60 text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-4 py-1.5 text-xs md:px-6"
    >
      <p className="min-w-0 flex-1">
        <span className="text-foreground font-medium">Demo:</span> simulated data, resets when you
        reload
      </p>
      <div className="-mr-1.5 flex items-center gap-1">
        <Button variant="ghost" size="xs" onClick={() => void startTour()}>
          <RouteIcon aria-hidden />
          Take the tour
        </Button>
        <Button variant="ghost" size="xs" asChild>
          <a href={REPOSITORY_URL} target="_blank" rel="noopener noreferrer">
            View on GitHub
            <ExternalLinkIcon aria-hidden />
          </a>
        </Button>
      </div>
    </div>
  );
}
