---
'@oakestra/api': minor
'@oakestra/ui': patch
---

`@oakestra/api`: `slaMicroserviceSchema` accepts `arch` (required by the backend for unikernels), and `ServiceCreateResult` types `deployed_services` and `failed_services` entries (`service_name`, `status`, `message`).

`@oakestra/ui`: the `DataTable` search box keeps its own text, so fast typing no longer loses characters when the controlled `globalFilter` lives in the URL.
