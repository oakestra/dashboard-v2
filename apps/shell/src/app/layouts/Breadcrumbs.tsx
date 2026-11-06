import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  cn,
} from '@oakestra/ui';
import { ChevronLeftIcon } from 'lucide-react';
import { Fragment } from 'react';
import { Link, useMatches } from 'react-router';

import { isAddonPageMatch, useAddonCrumbs } from '../../core/addons/addon-crumbs';
import { crumbOf, type Crumb } from '../../core/router/route-handle';

/**
 * One crumb per matched route that declares `handle.crumb`, with the addon page route expanded
 * into the addon's own trail. The last one is the current page.
 */
export function Breadcrumbs() {
  const matches = useMatches();
  const addonMatch = matches.find(isAddonPageMatch);
  const addonCrumbs = useAddonCrumbs(addonMatch);
  const crumbs = matches.flatMap((match): Crumb[] => {
    if (match === addonMatch) return addonCrumbs;
    const label = crumbOf(match);
    return label ? [{ id: match.id, label, to: match.pathname }] : [];
  });
  if (crumbs.length === 0) return null;
  const parent = crumbs.at(-2);

  return (
    <Breadcrumb data-testid="breadcrumbs" className="min-w-0">
      <BreadcrumbList className="flex-nowrap sm:gap-2">
        {/* Phones show only the current page, so this is their way back up the trail. */}
        {parent ? (
          <BreadcrumbItem className="md:hidden">
            <BreadcrumbLink asChild>
              <Link to={parent.to} aria-label="Back one level" className="-ml-1 p-1">
                <ChevronLeftIcon aria-hidden className="size-4" />
              </Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
        ) : null}
        {crumbs.map((crumb, index) => {
          const current = index === crumbs.length - 1;
          // Phones only have room for the current page; the trail starts at md.
          const trail = current ? '' : 'hidden md:inline-flex';
          return (
            <Fragment key={crumb.id}>
              {index > 0 ? <BreadcrumbSeparator className="hidden md:inline-flex" /> : null}
              <BreadcrumbItem className={cn('min-w-0', trail)}>
                {current ? (
                  <BreadcrumbPage className="truncate font-medium">{crumb.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild className="max-w-48 truncate">
                    <Link to={crumb.to}>{crumb.label}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
