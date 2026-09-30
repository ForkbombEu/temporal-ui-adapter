<script lang="ts">
  import { setContext } from "svelte";

  import {
    HISTORY_CTX,
    type HistoryContext,
  } from "$lib/contexts/history-context";
  import WorkflowHistoryLayout from "$lib/layouts/workflow-history-layout.svelte";
  import WorkflowTimelineLayout from "$lib/layouts/workflow-timeline-layout.svelte";
  import { toWorkflowExecution } from "$lib/models/workflow-execution";
  // v2.54.1 overlay target. Absent from fork v2.52 `src/` (uses fullEventHistory stores).
  import {
    ingestHistoryEvent,
    reset,
    setPendingMetadata,
  } from "$lib/services/grouped-event-buffer";
  import { eventBuffer } from "$lib/services/grouped-event-buffer.svelte";
  import { fullEventHistory } from "$lib/stores/events";
  import { workflowRun } from "$lib/stores/workflow-run";
  import type { HistoryEvent } from "$lib/types/events";
  import type { TaskQueueResponse } from "$lib/types";
  import type { WorkflowExecutionAPIResponse } from "$lib/types/workflows";

  import { ensureI18n } from "./ensure-i18n";
  import "./workflow-history.css";

  export type WorkflowHistoryProps = {
    /** Temporal GetWorkflowExecution / describe-execution API body. */
    execution: WorkflowExecutionAPIResponse;
    /** Raw history events (ingest converts via Upstream `toWorkflowEvent`). */
    history: HistoryEvent[];
    namespace: string;
    /** Optional DescribeTaskQueue / pollers snapshot. Omit → Upstream defaults (Q6 B). */
    workers?: TaskQueueResponse;
  };

  let { execution, history, namespace, workers }: WorkflowHistoryProps =
    $props();

  const workflow = $derived.by(() => {
    const model = toWorkflowExecution(execution);
    Object.defineProperty(model, "canBeTerminated", {
      value: false,
      configurable: true,
    });
    return model;
  });

  const latestEventId = $derived(
    history.reduce((max, event) => Math.max(max, parseInt(event.eventId)), 0),
  );

  setContext<HistoryContext>(HISTORY_CTX, {
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

  // Sync Host props into Upstream stores/buffer (external module state — not component $state).
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

    setPendingMetadata(
      workflow.pendingActivities ?? [],
      workflow.pendingNexusOperations ?? [],
    );
  });

  $effect.pre(() => {
    if (bufferedRunId !== workflow.runId) {
      reset(history.length);
      bufferedRunId = workflow.runId;
      fullEventHistory.set([]);
    }
    for (const event of history) ingestHistoryEvent(event);
  });

  // Upstream workflow-run-layout mirrors buffer → fullEventHistory for Input/Result.
  $effect(() => {
    fullEventHistory.set(eventBuffer.events);
  });
</script>

{#await ensureI18n() then}
  <div
    class="temporal-ui"
    data-forkbomb="workflow-history"
    data-namespace={namespace}
  >
    <div class="views">
      <WorkflowTimelineLayout />
      <!-- History below timeline; hide duplicate Input/Result + error chrome. -->
      <div class="history-below">
        <WorkflowHistoryLayout />
      </div>
    </div>
  </div>
{/await}

<style>
  .views {
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  /* Both Upstream layouts own Input/Result — keep the timeline copy only. */
  .history-below :global([data-testid="input-and-result"]) {
    display: none;
  }

  /* Prefer CSS-only link disable — no Upstream patches. */
  :global(.temporal-ui a[href]) {
    pointer-events: none;
    cursor: default;
    text-decoration: none;
  }
</style>
