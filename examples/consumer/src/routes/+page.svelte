<script>
  import '../app.css';
  import { WorkflowStatus, WorkflowHistory } from '@forkbombeu/temporal-ui';
  import historyFixture from '$lib/fixtures/history.fixture.json';
  import execution from '$lib/fixtures/workflow.fixture.json';

  //

  const history = historyFixture.history;

  const demoStatuses = [
    'Running',
    'Completed',
    'Failed',
    'Canceled',
    'Terminated',
    'TimedOut',
    'ContinuedAsNew',
  ];
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
