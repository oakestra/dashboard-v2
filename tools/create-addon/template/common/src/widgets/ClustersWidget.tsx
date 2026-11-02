import { useAddonBasePath, useOakestraApi } from '@oakestra/dashboard-sdk';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';

import { clustersQuery } from '../queries';

export function ClustersWidget() {
  const api = useOakestraApi();
  const basePath = useAddonBasePath();
  const clusters = useQuery(clustersQuery(api));

  return (
    <p className="__PREFIX__:text-sm">
      {clusters.isSuccess ? `${clusters.data.length} clusters. ` : ''}
      <Link className="__PREFIX__:underline" to={basePath}>
        Open __LABEL__
      </Link>
    </p>
  );
}
