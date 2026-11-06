import type { Meta, StoryObj } from '@storybook/react-vite';

// Token names, not values: the swatches read the live CSS variables, so this page always shows
// what styles.css defines for the current theme.
const GROUPS: { title: string; description: string; tokens: string[] }[] = [
  {
    title: 'Surfaces',
    description: 'Page, cards and floating layers, each with the text color that goes on it.',
    tokens: [
      'background',
      'foreground',
      'card',
      'card-foreground',
      'popover',
      'popover-foreground',
    ],
  },
  {
    title: 'Brand and neutrals',
    description:
      'Neutrals are a cool gray used for content. The primary is the slate-teal of the Oakestra lettering, used for what you can act on, nothing else.',
    tokens: [
      'primary',
      'primary-foreground',
      'secondary',
      'secondary-foreground',
      'muted',
      'muted-foreground',
      'accent',
      'accent-foreground',
    ],
  },
  {
    title: 'Status',
    description:
      'Readable as text on the card and on their own soft tint. Only warning and destructive are saturated; success has low chroma. -foreground is for text on the solid color.',
    tokens: [
      'success',
      'success-foreground',
      'warning',
      'warning-foreground',
      'info',
      'info-foreground',
      'destructive',
      'destructive-foreground',
    ],
  },
  {
    title: 'Lines and focus',
    description: 'Borders, input outlines and the focus ring.',
    tokens: ['border', 'input', 'ring'],
  },
  {
    title: 'Charts',
    description: 'Series colors, in order. Starts with the brand, then the leaf green of the logo.',
    tokens: ['chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-5'],
  },
  {
    title: 'Sidebar',
    description:
      'The navigation sits on a light tint of the page in light mode and a darker one in dark mode. Anything inside it uses these tokens only.',
    tokens: [
      'sidebar',
      'sidebar-foreground',
      'sidebar-primary',
      'sidebar-primary-foreground',
      'sidebar-accent',
      'sidebar-accent-foreground',
      'sidebar-border',
      'sidebar-ring',
    ],
  },
];

function Swatch({ token }: { token: string }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="size-10 shrink-0 rounded-md border"
        style={{ background: `var(--${token})` }}
      />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{token}</p>
        <code className="text-xs text-muted-foreground">--{token}</code>
      </div>
    </div>
  );
}

const meta = {
  title: 'Foundations/Colors',
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Every color is a CSS variable from `styles.css`, mapped to Tailwind in `theme.css` (`bg-primary`, `text-muted-foreground`, ...). Switch the theme in the toolbar to see the dark values.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Tokens: Story = {
  render: () => (
    <div className="space-y-6">
      {GROUPS.map((group) => (
        <section key={group.title} className="space-y-3">
          <div>
            <h2 className="text-base font-semibold">{group.title}</h2>
            <p className="text-sm text-muted-foreground">{group.description}</p>
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] gap-4">
            {group.tokens.map((token) => (
              <Swatch key={token} token={token} />
            ))}
          </div>
        </section>
      ))}
    </div>
  ),
};

export const Radius: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'A 2/4/6/8px scale that follows hierarchy: `sm` for tags and badges, `md` for controls, `lg` for panels and cards, `xl` for overlays. `rounded-full` is for avatars only.',
      },
    },
  },
  render: () => (
    <div className="flex flex-wrap gap-6">
      {(['sm', 'md', 'lg', 'xl'] as const).map((size) => (
        <div key={size} className="flex flex-col items-center gap-2">
          <div
            className="size-16 border-2 border-primary"
            style={{ borderRadius: `var(--radius-${size})` }}
          />
          <code className="text-xs text-muted-foreground">rounded-{size}</code>
        </div>
      ))}
    </div>
  ),
};

export const Typography: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Geist for the interface, Geist Mono for identifiers and machine values only (image references, IPs, ids, env keys, JSON, logs), never for labels or counts. Body text is 14px (`text-sm`). Both fonts are self-hosted. Use sentence case everywhere and `tabular-nums` for numbers.',
      },
    },
  },
  render: () => (
    <div className="max-w-xl space-y-3">
      <p className="text-base font-semibold">Page and section titles are semibold</p>
      <p className="text-sm">
        Body text is 13.5px. Secondary text is smaller and muted.{' '}
        <span className="text-muted-foreground">Sentence case, plain words.</span>
      </p>
      <p className="text-xs text-muted-foreground">Hints and captions use text-xs.</p>
      <p className="text-sm tabular-nums">Numbers line up: 1,204 / 98 / 7</p>
      <p className="font-mono text-xs">registry.example.com/oakestra/nginx:1.27</p>
    </div>
  ),
};
