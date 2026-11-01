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
    description: 'The primary is the slate-teal of the Oakestra lettering.',
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
      'Readable as text on the card and on their own 10% tint. -foreground is for text on the solid color.',
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
    description: 'The navigation has its own slightly darker surface.',
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
        className="size-10 shrink-0 rounded-md border shadow-xs"
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
    <div className="space-y-8">
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
  render: () => (
    <div className="flex flex-wrap gap-6">
      {(['sm', 'md', 'lg', 'xl'] as const).map((size) => (
        <div key={size} className="flex flex-col items-center gap-2">
          <div
            className="size-16 border-2 border-primary bg-primary/10"
            style={{ borderRadius: `var(--radius-${size})` }}
          />
          <code className="text-xs text-muted-foreground">rounded-{size}</code>
        </div>
      ))}
    </div>
  ),
};
