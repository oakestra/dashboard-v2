import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  cn,
} from '@oakestra/ui';
import { Fragment } from 'react';
import { Link, useMatches } from 'react-router';

import { crumbOf } from '../../core/router/route-handle';

/** One crumb per matched route that declares `handle.crumb`; the last one is the current page. */
export function Breadcrumbs() {
  const crumbs = useMatches().flatMap((match) => {
    const label = crumbOf(match);
    return label ? [{ id: match.id, label, to: match.pathname }] : [];
  });
  if (crumbs.length === 0) return null;

  return (
    <Breadcrumb data-testid="breadcrumbs" className="min-w-0">
      <BreadcrumbList className="flex-nowrap sm:gap-2">
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
