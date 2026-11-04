import {
  useCurrentUser,
  type SlotSource,
  type Widget,
  type WidgetSize,
} from '@oakestra/dashboard-sdk';
import { Card, CardContent, CardHeader, CardTitle, EmptyState, PageHeader } from '@oakestra/ui';
import { LayoutDashboardIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { Slot } from '../../../core/extensions/Slot';
import { useContributions } from '../../../core/extensions/use-contributions';

/** `card` unless the widget asks otherwise; the definition parser already dropped unknown sizes. */
function sizeOf(widget: Widget): WidgetSize {
  return widget.size ?? 'card';
}

const isSize = (size: WidgetSize) => (widget: Widget) => sizeOf(widget) === size;
const isStat = isSize('stat');
const isWide = isSize('wide');
const isCard = isSize('card');

// A widget may render nothing (a "needs attention" list with nothing to report), which leaves its
// wrapper empty. `[&>:empty]:hidden` drops such wrappers, and since the sections space their
// children with `gap` (which skips hidden items, unlike `space-y`) they leave no hole behind.
const HIDE_EMPTY = 'empty:hidden [&>:empty]:hidden';

function frame(widget: Widget, source: SlotSource, content: ReactNode, className?: string) {
  return (
    <div
      data-testid="home-widget"
      data-widget-id={`${source.id}:${widget.id}`}
      data-size={sizeOf(widget)}
      className={className}
    >
      {content}
    </div>
  );
}

/**
 * The start page. Everything on it except the greeting comes from `home.widgets`: the features
 * (linked packages and remote addons alike) contribute their summaries there, so a feature a
 * preset leaves out takes its tiles with it.
 */
export function OverviewPage() {
  const user = useCurrentUser()!;
  // Only to decide whether to show the empty state; the slots below select their own share.
  const widgets = useContributions('home.widgets');

  return (
    <div className="space-y-6">
      <PageHeader title="Overview" description={`Welcome back, ${user.username}.`} />

      {widgets.length === 0 ? (
        <EmptyState
          data-testid="overview-empty"
          icon={<LayoutDashboardIcon />}
          title="Nothing to show yet"
          description="The features of this dashboard show their summaries here. None that you can see has one."
        />
      ) : null}

      <section
        aria-label="Summary"
        className={`grid grid-cols-2 gap-4 lg:grid-cols-4 ${HIDE_EMPTY}`}
        data-testid="overview-summary"
      >
        {/* A grid wrapper so the tile (StatCard is h-full) fills its row like a direct child. */}
        <Slot
          point="home.widgets"
          filter={isStat}
          render={(widget, content, source) => frame(widget, source, content, 'grid')}
        />
      </section>

      <div className={`flex flex-col gap-6 ${HIDE_EMPTY}`} data-testid="home-sections">
        <Slot
          point="home.widgets"
          filter={isWide}
          render={(widget, content, source) => frame(widget, source, content)}
        />
      </div>

      {/* No empty state of its own: a page without any widget has the one above. */}
      <section
        aria-label="Widgets"
        className="grid gap-4 empty:hidden md:grid-cols-2 xl:grid-cols-3"
        data-testid="home-widgets"
      >
        <Slot
          point="home.widgets"
          filter={isCard}
          render={(widget, content, source) => (
            <Card
              data-testid="home-widget"
              data-widget-id={`${source.id}:${widget.id}`}
              data-size="card"
            >
              <CardHeader>
                <CardTitle>{widget.title}</CardTitle>
              </CardHeader>
              <CardContent>{content}</CardContent>
            </Card>
          )}
        />
      </section>
    </div>
  );
}
