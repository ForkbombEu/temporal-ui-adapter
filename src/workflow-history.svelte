<script lang="ts">
  import { setContext } from 'svelte';

  import {
    HISTORY_CTX,
  } from '$lib/contexts/history-context';
  import WorkflowHistoryLayout from '$lib/layouts/workflow-history-layout.svelte';
  import WorkflowTimelineLayout from '$lib/layouts/workflow-timeline-layout.svelte';
  import { toWorkflowExecution } from '$lib/models/workflow-execution';
  import {
    ingestHistoryEvent,
    reset,
    setPendingMetadata,
  } from '$lib/services/grouped-event-buffer';
  import { eventBuffer } from '$lib/services/grouped-event-buffer.svelte';
  import { fullEventHistory } from '$lib/stores/events';
  import { workflowRun } from '$lib/stores/workflow-run';
  import type { HistoryEvent } from '$lib/types/events';
  import type { TaskQueueResponse } from '$lib/types';
  import type { WorkflowExecutionAPIResponse } from '$lib/types/workflows';

  import { setWorkflowRouteParams } from './app-bridge';
  import { ensureI18n } from './ensure-i18n';
  import './workflow-history.css';

  export type WorkflowHistoryProps = {
    execution: WorkflowExecutionAPIResponse;
    history: HistoryEvent[];
    namespace: string;
    workers?: TaskQueueResponse;
    /** Bisect aid: stub | timeline | history | full */
    debugMode?: string;
  };

  let {
    execution,
    history,
    namespace,
    workers,
    debugMode = 'full',
  }: WorkflowHistoryProps = $props();

  const workflow = $derived.by(() => {
    const model = toWorkflowExecution(execution);
    Object.defineProperty(model, 'canBeTerminated', {
      value: false,
      configurable: true,
    });
    return model;
  });

  $effect.pre(() => {
    setWorkflowRouteParams({
      namespace,
      workflow: workflow.id,
      run: workflow.runId,
    });
  });

  const latestEventId = $derived(
    history.reduce((max, event) => Math.max(max, parseInt(event.eventId)), 0),
  );

  setContext(HISTORY_CTX, {
    fetchComplete: true,
    get latestEventId() {
      return latestEventId;
    },
    get totalExpectedEvents() {
      return history.length;
    },
    descMinId: 1,
    resume() {},
  });

  let bufferedRunId: string | undefined;

  $effect.pre(() => {
    workflowRun.update((run) => {
      if (workers !== undefined) {
        return {
          ...run,
          workflow,
          workers,
          workersLoaded: true,
        };
      }
      return { ...run, workflow };
    });
    setPendingMetadata(workflow.pendingActivities ?? [], workflow.pendingNexusOperations ?? []);
  });

  $effect.pre(() => {
    if (bufferedRunId !== workflow.runId) {
      reset(history.length);
      bufferedRunId = workflow.runId;
      fullEventHistory.set([]);
    }
    for (const event of history) ingestHistoryEvent(event);
  });

  $effect(() => {
    fullEventHistory.set(eventBuffer.events);
  });
</script>

{#await ensureI18n() then}
  <div
    class="temporal-ui"
    data-forkbomb="workflow-history"
    data-namespace={namespace}
    data-debug={debugMode}
  >
    {#if debugMode === 'stub'}
      <p>stub-ok {workflow.id}</p>
    {:else if debugMode === 'timeline'}
      <WorkflowTimelineLayout />
    {:else if debugMode === 'history'}
      <WorkflowHistoryLayout />
    {:else}
      <div class="views">
        <WorkflowTimelineLayout />
        <div class="history-below">
          <WorkflowHistoryLayout />
        </div>
      </div>
    {/if}
  </div>
{/await}

<style>
  .views {
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }
  .history-below :global([data-testid='input-and-result']) {
    display: none;
  }
  :global(.temporal-ui a[href]) {
    pointer-events: none;
    cursor: default;
    text-decoration: none;
  }
</style>
