import { Deployment, LogEntry, Project } from './types';

export const DEPLOYS: Deployment[] = [
  { id: 'fn_demo_core_active', project: 'Core Platform', branch: 'main', commit: '7a0f3d2', env: 'Production', status: 'Active', age: '2m', region: 'ap-south-1' },
  { id: 'fn_demo_api_stage', project: 'API Gateway', branch: 'feat/auth', commit: '3c9e1a0', env: 'Staging', status: 'Active', age: '14m', region: 'ap-south-2' },
  { id: 'fn_demo_design_ready', project: 'Design System', branch: 'main', commit: 'b4d5f2e', env: 'Staging', status: 'Ready', age: '1h', region: 'ap-southeast-1' },
  { id: 'fn_demo_core_building', project: 'Core Platform', branch: 'fix/memory', commit: '9a2b3c4', env: 'Staging', status: 'Building', age: '3m', region: 'ap-south-1' },
  { id: 'fn_demo_analytics_failed', project: 'Analytics', branch: 'main', commit: '1d2e3f4', env: 'Production', status: 'Failed', age: '2h', region: 'ap-south-2' },
  { id: 'fn_demo_auth_active', project: 'Auth Service', branch: 'main', commit: 'c5d6e7f', env: 'Production', status: 'Active', age: '6h', region: 'ap-southeast-1' },
];

export const LOGS: LogEntry[] = [
  { t: '14:22:01.042', level: 'INFO', msg: 'Build pipeline initiated: core-platform-v2' },
  { t: '14:22:01.118', level: 'INFO', msg: 'Pulling from registry: lecrev.sh/core:7a0f3d2' },
  { t: '14:22:01.892', level: 'INFO', msg: 'Layer cache hit: base-node-22' },
  { t: '14:22:02.003', level: 'WARN', msg: 'Dependency lockfile drift detected. 3 packages updated.' },
  { t: '14:22:02.441', level: 'INFO', msg: 'Installing dependencies: 847 packages' },
  { t: '14:22:03.009', level: 'ERROR', msg: 'Timeout: upstream registry unreachable (retry 1/3)' },
  { t: '14:22:03.102', level: 'INFO', msg: 'Retry successful: registry connection restored' },
  { t: '14:22:04.221', level: 'INFO', msg: 'Compiling TypeScript: 0 errors, 2 warnings' },
  { t: '14:22:04.889', level: 'WARN', msg: 'Bundle size exceeded threshold: 2.4mb > 2mb' },
  { t: '14:22:05.001', level: 'INFO', msg: 'Asset optimisation complete: 847kb saved' },
  { t: '14:22:05.344', level: 'INFO', msg: 'Running test suite: 124/124 passed' },
  { t: '14:22:06.009', level: 'INFO', msg: 'Deploying to ap-south-1 edge host' },
  { t: '14:22:06.441', level: 'INFO', msg: 'Health check passed: 200 OK (42ms)' },
  { t: '14:22:06.889', level: 'INFO', msg: 'Artifact replication complete across APAC regions' },
  { t: '14:22:07.001', level: 'INFO', msg: 'Deployment complete: lecrev.sh/main-7a0f3d2 · ap-south-1' },
];

export const PROJECTS: Project[] = [
  { id: 'core-platform', name: 'Core Platform', url: 'core-platform.lecrev.app', status: 'Production', instances: '24 Instances', active: true },
  { id: 'api-gateway', name: 'API Gateway', url: 'api.lecrev.sh', status: 'Staging', instances: '4 Instances' },
  { id: 'design-system', name: 'Design System', url: 'ui-library.internal', status: 'Staging', instances: 'Ready' },
];
