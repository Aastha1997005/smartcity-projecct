Service grouping notes

Pipelines and Water services
- Pipelines are part of water distribution infrastructure and are now accessible under the utilities (water) namespace for convenience.
- New endpoints (non-breaking additions):
  - GET /api/utilities/water/pipelines
  - GET /api/utilities/water/pipelines/:pipeline_id
  - POST /api/utilities/water/pipelines
  - PUT /api/utilities/water/pipelines/:pipeline_id
  - DELETE /api/utilities/water/pipelines/:pipeline_id

Notes
- The original `/api/pipelines` endpoints remain available for backward compatibility.
- If you want `Pipeline` to be removed from its own route file and fully merged, I can rename and refactor but that is a breaking change for external clients.
