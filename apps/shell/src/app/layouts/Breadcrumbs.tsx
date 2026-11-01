import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
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
    <Breadcrumb data-testid="breadcrumbs">
      <BreadcrumbList>
        {crumbs.map((crumb, index) => (
          <Fragment key={crumb.id}>
            {index > 0 ? <BreadcrumbSeparator /> : null}
            <BreadcrumbItem>
              {index === crumbs.length - 1 ? (
                <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink asChild>
                  <Link to={crumb.to}>{crumb.label}</Link>
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
