<script>
  import { WorkflowHistory, WorkflowStatus } from '@forkbombeu/temporal-ui';

  import historyFixture from '$lib/fixtures/history.fixture.json';
  import execution from '$lib/fixtures/workflow.fixture.json';

  /** Badge wants readable labels; describe API returns proto enums. */
  const readableStatus = {
    WORKFLOW_EXECUTION_STATUS_RUNNING: 'Running',
    WORKFLOW_EXECUTION_STATUS_COMPLETED: 'Completed',
    WORKFLOW_EXECUTION_STATUS_FAILED: 'Failed',
    WORKFLOW_EXECUTION_STATUS_CANCELED: 'Canceled',
    WORKFLOW_EXECUTION_STATUS_TERMINATED: 'Terminated',
    WORKFLOW_EXECUTION_STATUS_CONTINUED_AS_NEW: 'ContinuedAsNew',
    WORKFLOW_EXECUTION_STATUS_TIMED_OUT: 'TimedOut',
    WORKFLOW_EXECUTION_STATUS_PAUSED: 'Paused',
  };

  const history = historyFixture.history;
  const rawStatus = execution.workflowExecutionInfo.status;
  const status = readableStatus[rawStatus] ?? rawStatus;
</script>

<main class="space-y-4 p-4">
  <WorkflowStatus {status} />
  <WorkflowHistory {execution} {history} namespace="default" />
</main>
