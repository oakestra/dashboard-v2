import {
  Badge,
  Button,
  Checkbox,
  Input,
  Label,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  cn,
  plural,
} from '@oakestra/ui';
import {
  HashIcon,
  LayoutGridIcon,
  ListFilterIcon,
  SearchIcon,
  SlidersHorizontalIcon,
  StoreIcon,
  XIcon,
  type LucideIcon,
} from 'lucide-react';
import { useId, useState } from 'react';

import {
  activeFilterCount,
  byName,
  categoryLabel,
  type FacetCount,
  type FacetCounts,
  type MarketplaceFilters,
} from '../marketplace-filters';

type ListKey = 'categories' | 'sources' | 'tags';
type Pane = ListKey | 'properties';

interface ListFacet {
  key: ListKey;
  heading: string;
  /** For "No matching tag" and "Clear the tag filter". */
  noun: string;
  /** For "Search tags". */
  plural: string;
  icon: LucideIcon;
  label: (value: string) => string;
}

// Category first: it is what most people browse by.
const LIST_FACETS: readonly ListFacet[] = [
  {
    key: 'categories',
    heading: 'Category',
    noun: 'category',
    plural: 'categories',
    icon: LayoutGridIcon,
    label: categoryLabel,
  },
  {
    key: 'sources',
    heading: 'Source',
    noun: 'source',
    plural: 'sources',
    icon: StoreIcon,
    label: (value) => value,
  },
  {
    key: 'tags',
    heading: 'Tag',
    noun: 'tag',
    plural: 'tags',
    icon: HashIcon,
    label: (value) => `#${value}`,
  },
];

/** The yes/no filters, each a single checkbox: only one direction of each is worth filtering by. */
const PROPERTIES = [
  {
    key: 'withUi',
    label: 'Has a dashboard UI',
    description: 'Adds pages, widgets or menu entries to this dashboard.',
  },
  {
    key: 'withoutDangerous',
    label: 'No dangerous permissions',
    description: 'Leaves out addons that ask for the Docker socket, system paths or networks.',
  },
] as const;

/** Lists this long get a search field; a few values are quicker to scan than to type. */
const SEARCH_FROM = 8;

/** How a filter's selection reads under its name, from the labels of what is chosen. */
function summary(labels: readonly string[]): string {
  if (labels.length === 0) return 'Any';
  return labels.length === 1 ? labels[0]! : `${labels.length} selected`;
}

/**
 * The options of a list, plus checked values the counts do not list (no addon left under the
 * other filters, or a link with a source that is gone), so they can still be seen and unchecked.
 * Sorted lists keep them in their place; sources keep the catalog's order and get them last.
 */
function optionsOf(
  counts: readonly FacetCount[],
  checked: readonly string[],
  sorted: boolean,
): FacetCount[] {
  const missing = checked.filter((value) => !counts.some((option) => option.name === value));
  const options = [...counts, ...missing.map((name) => ({ name, count: 0 }))];
  return sorted ? options.sort(byName) : options;
}

/** One labelled checkbox row with an optional description and a count on the right. */
function CheckboxRow({
  label,
  description,
  count,
  checked,
  onCheckedChange,
}: {
  label: string;
  description?: string;
  count: number;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="hover:bg-accent/60 flex items-start gap-2.5 rounded-md px-2 py-1.5">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(value) => onCheckedChange(value === true)}
        className="mt-0.5"
        // Starts with the visible text so voice control can target it.
        aria-label={`${label} (${count})`}
      />
      <Label htmlFor={id} className="grid min-w-0 flex-1 cursor-pointer gap-0.5 font-normal">
        <span className="truncate">{label}</span>
        {description ? (
          <span className="text-muted-foreground text-xs leading-snug">{description}</span>
        ) : null}
      </Label>
      <span aria-hidden className="text-muted-foreground mt-0.5 text-xs tabular-nums">
        {count}
      </span>
    </div>
  );
}

/** The values of one list filter as checkboxes, with a search field once the list is long. */
function ListPane({
  facet,
  options,
  checked,
  onChange,
}: {
  facet: ListFacet;
  options: readonly FacetCount[];
  checked: readonly string[];
  onChange: (values: string[]) => void;
}) {
  const [query, setQuery] = useState('');
  const needle = query.trim().toLowerCase();
  const shown = needle
    ? options.filter((option) => facet.label(option.name).toLowerCase().includes(needle))
    : options;
  const toggle = (value: string, on: boolean) =>
    onChange(on ? [...checked, value] : checked.filter((candidate) => candidate !== value));

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex min-h-11 items-center gap-2 border-b px-3">
        {options.length >= SEARCH_FROM ? (
          <div className="relative min-w-0 flex-1">
            <SearchIcon
              aria-hidden
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-0 size-4 -translate-y-1/2"
            />
            <Input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={`Search ${facet.plural}`}
              aria-label={`Search ${facet.plural}`}
              className="h-9 border-0 bg-transparent pl-6 shadow-none focus-visible:ring-0 dark:bg-transparent"
            />
          </div>
        ) : (
          <span className="text-muted-foreground flex-1 text-xs">
            Any checked {facet.noun} matches
          </span>
        )}
        {checked.length > 0 ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            aria-label={`Clear the ${facet.noun} filter`}
            onClick={() => onChange([])}
          >
            Clear
          </Button>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-1.5" role="group" aria-label={facet.heading}>
        {shown.length === 0 ? (
          <p className="text-muted-foreground px-2 py-6 text-center text-sm">
            No matching {facet.noun}.
          </p>
        ) : (
          shown.map((option) => (
            <CheckboxRow
              key={option.name}
              label={facet.label(option.name)}
              count={option.count}
              checked={checked.includes(option.name)}
              onCheckedChange={(on) => toggle(option.name, on)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function FilterTab({
  value,
  icon: Icon,
  heading,
  selection,
  active,
}: {
  value: Pane;
  icon: LucideIcon;
  heading: string;
  selection: string;
  active: boolean;
}) {
  return (
    <TabsTrigger
      value={value}
      className="hover:bg-accent/60 data-[state=active]:bg-accent mb-0 h-auto min-h-9 flex-1 justify-start gap-2 rounded-md border-b-0 px-2.5 py-1.5 text-left sm:flex-none"
    >
      <Icon aria-hidden />
      <span className="flex min-w-0 flex-col">
        <span className="truncate">{heading}</span>

        <span
          className={cn(
            'truncate text-xs font-normal',
            active ? 'text-foreground' : 'text-muted-foreground',
          )}
        >
          {selection}
        </span>
      </span>
    </TabsTrigger>
  );
}

/**
 * Filters on the left with their current selection, the selected filter's values on the right.
 * Lists match any checked value; the two properties only offer the direction worth filtering by.
 */
export function MarketplaceFilterMenu({
  counts,
  filters,
  resultCount,
  onChange,
  onClear,
}: {
  counts: FacetCounts;
  filters: MarketplaceFilters;
  /** Addons the filters leave, before the search text. */
  resultCount: number;
  onChange: (filters: MarketplaceFilters) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pane, setPane] = useState<Pane>('categories');
  const activeCount = activeFilterCount(filters);
  const properties = PROPERTIES.filter(({ key }) => filters[key]);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        // Open on the first filter that is set, so the current selection is in view.
        if (next) {
          setPane(
            LIST_FACETS.find(({ key }) => filters[key].length > 0)?.key ??
              (properties.length > 0 ? 'properties' : 'categories'),
          );
        }
        setOpen(next);
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          aria-label={activeCount > 0 ? `Filter, ${activeCount} active` : 'Filter'}
        >
          <ListFilterIcon aria-hidden data-icon="inline-start" />
          Filter
          {activeCount > 0 ? (
            <Badge variant="secondary" className="rounded-full px-1.5 tabular-nums">
              {activeCount}
            </Badge>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[min(36rem,calc(100vw-2rem))] p-0"
        aria-label="Filters"
      >
        <Tabs
          value={pane}
          onValueChange={(value) => setPane(value as Pane)}
          orientation="vertical"
          // A fixed height, so switching filters does not move the footer and its buttons.
          className="h-80 gap-0 sm:flex-row"
        >
          {/* A row of tabs on a phone, a column next to the values from sm on. */}
          <TabsList className="shrink-0 gap-1 p-1.5 sm:w-48 sm:flex-col sm:items-stretch sm:border-r sm:border-b-0">
            {LIST_FACETS.map((facet) => (
              <FilterTab
                key={facet.key}
                value={facet.key}
                icon={facet.icon}
                heading={facet.heading}
                selection={summary(filters[facet.key].map(facet.label))}
                active={filters[facet.key].length > 0}
              />
            ))}
            <FilterTab
              value="properties"
              icon={SlidersHorizontalIcon}
              heading="Properties"
              selection={summary(properties.map((property) => property.label))}
              active={properties.length > 0}
            />
          </TabsList>
          {LIST_FACETS.map((facet) => (
            <TabsContent key={facet.key} value={facet.key} className="min-h-0 min-w-0">
              <ListPane
                facet={facet}
                options={optionsOf(counts[facet.key], filters[facet.key], facet.key !== 'sources')}
                checked={filters[facet.key]}
                onChange={(values) => onChange({ ...filters, [facet.key]: values })}
              />
            </TabsContent>
          ))}
          <TabsContent value="properties" className="min-h-0 min-w-0">
            <div className="grid gap-1 p-1.5" role="group" aria-label="Properties">
              {PROPERTIES.map((property) => (
                <CheckboxRow
                  key={property.key}
                  label={property.label}
                  description={property.description}
                  count={counts[property.key]}
                  checked={filters[property.key]}
                  onCheckedChange={(on) => onChange({ ...filters, [property.key]: on })}
                />
              ))}
            </div>
          </TabsContent>
        </Tabs>
        <div className="flex items-center justify-between gap-2 border-t px-3 py-2">
          <span className="text-muted-foreground text-xs tabular-nums" aria-live="polite">
            {plural(resultCount, 'addon')}
          </span>
          <div className="flex gap-1.5">
            <Button variant="ghost" size="sm" disabled={activeCount === 0} onClick={onClear}>
              Clear all
            </Button>
            <Button size="sm" onClick={() => setOpen(false)}>
              Done
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** The active filters as removable chips under the toolbar, with a way to clear them all. */
export function ActiveFilterChips({
  filters,
  onChange,
  onClear,
}: {
  filters: MarketplaceFilters;
  onChange: (filters: MarketplaceFilters) => void;
  onClear: () => void;
}) {
  const chips = [
    ...LIST_FACETS.filter(({ key }) => filters[key].length > 0).map((facet) => ({
      id: facet.key,
      heading: facet.heading,
      // All values, not "2 selected": the chip is the only place they are listed.
      value: filters[facet.key].map(facet.label).join(', '),
      removeLabel: `Remove the ${facet.noun} filter ${filters[facet.key].join(', ')}`,
      remove: () => onChange({ ...filters, [facet.key]: [] }),
    })),
    ...PROPERTIES.filter(({ key }) => filters[key]).map((property) => ({
      id: property.key,
      heading: '',
      value: property.label,
      removeLabel: `Remove the filter ${property.label}`,
      remove: () => onChange({ ...filters, [property.key]: false }),
    })),
  ];
  if (chips.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5" data-testid="active-filters">
      {chips.map((chip) => (
        <Badge
          key={chip.id}
          variant="secondary"
          className="h-7 max-w-full gap-1.5 pr-1 pl-2.5 font-normal"
        >
          {chip.heading ? <span className="text-muted-foreground">{chip.heading}</span> : null}
          <span className="truncate font-medium">{chip.value}</span>
          <button
            type="button"
            className="hover:bg-background/80 focus-visible:ring-ring ml-0.5 rounded-sm p-0.5 outline-none focus-visible:ring-2"
            aria-label={chip.removeLabel}
            onClick={chip.remove}
          >
            <XIcon aria-hidden className="size-3.5" />
          </button>
        </Badge>
      ))}
      <Button variant="ghost" size="sm" className="h-7 px-2" onClick={onClear}>
        Clear all
      </Button>
    </div>
  );
}
