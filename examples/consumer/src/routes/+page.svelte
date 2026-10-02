<script lang="ts">
  import type { ComponentProps } from 'svelte';
  import '../app.css';
  import { WorkflowStatus, WorkflowHistory } from '@forkbombeu/temporal-ui';
  import historyFixture from '$lib/fixtures/history.fixture.json';
  import executionFixture from '$lib/fixtures/workflow.fixture.json';

  type Status = ComponentProps<typeof WorkflowStatus>['status'];
  type HistoryProps = ComponentProps<typeof WorkflowHistory>;

  // JSON imports are widened; assert into Adapter prop types for the smoke Host.
  const execution = executionFixture as HistoryProps['execution'];
  const history = historyFixture.history as HistoryProps['history'];

  const demoStatuses = [
    'Running',
    'Completed',
    'Failed',
    'Canceled',
    'Terminated',
    'TimedOut',
    'ContinuedAsNew',
  ] as const satisfies readonly Status[];
</script>

<main class="space-y-4 p-8">
  <h1 class="text-2xl font-bold">Host app (Tailwind 4)</h1>
  <div class="flex flex-wrap gap-2">
    {#each demoStatuses as status (status)}
      <WorkflowStatus {status} />
    {/each}
  </div>

  <hr />

  <WorkflowHistory {execution} {history} namespace="default" />
</main>
