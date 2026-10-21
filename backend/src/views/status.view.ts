export interface StatusInfo {
  nodeEnv: string;
  uptimeSeconds: number;
}

function formatUptime(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);

  if (hours > 0) return `${hours} h ${minutes} min`;
  if (minutes > 0) return `${minutes} min ${seconds} s`;
  return `${seconds} s`;
}

export function renderStatusPage(status: StatusInfo): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Asset Store API</title>
  <style>
    :root { color-scheme: light dark; }
    body { font-family: system-ui, sans-serif; max-width: 32rem; margin: 4rem auto; padding: 0 1rem; line-height: 1.5; }
    .ok { color: #1a7f37; font-weight: 600; }
    dl { display: grid; grid-template-columns: max-content 1fr; gap: 0.25rem 1rem; }
    dt { opacity: 0.7; }
    dd { margin: 0; }
  </style>
</head>
<body>
  <h1>Asset Store API</h1>
  <p class="ok">&#9679; Server is running</p>
  <dl>
    <dt>Environment</dt><dd>${status.nodeEnv}</dd>
    <dt>Uptime</dt><dd>${formatUptime(status.uptimeSeconds)}</dd>
  </dl>
  <p>Endpoints: <a href="/api/health">/api/health</a> &middot; <a href="/api/assets">/api/assets</a></p>
</body>
</html>
`;
}
