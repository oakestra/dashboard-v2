import { z } from 'zod';

import { list, optionalString } from './common.ts';

/** Older backends embedded whole service objects in `microservices`; current ones send ids. */
const serviceReference = z.union([
  z.string(),
  z.looseObject({ _id: z.string() }).transform((service) => service._id),
]);

export const applicationSchema = z.looseObject({
  _id: z.string(),
  applicationID: optionalString,
  application_name: z.string(),
  application_namespace: z.string(),
  application_desc: optionalString.transform((value) => value ?? ''),
  /** Ids of the application's services. */
  microservices: list(serviceReference),
  /** Username of the owner (despite the name, not the user's `_id`). */
  userId: optionalString,
});

export type Application = z.infer<typeof applicationSchema>;

/** Fields `PUT /application/{id}` actually applies; the backend ignores everything else. */
export interface ApplicationUpdate {
  application_name?: string;
  application_namespace?: string;
  application_desc?: string;
  microservices?: string[];
}
