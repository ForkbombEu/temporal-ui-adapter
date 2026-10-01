<script>
  import { WorkflowHistory, WorkflowStatus } from '@forkbombeu/temporal-ui';
  import historyFixture from '$lib/fixtures/history.fixture.json';
  import execution from '$lib/fixtures/workflow.fixture.json';

  const history = historyFixture.history;
  const status = execution.workflowExecutionInfo?.status ?? 'Running';
</script>

<main class="space-y-4 p-4">
  <WorkflowStatus {status} />
  <WorkflowHistory {execution} {history} namespace="default" />
</main>
