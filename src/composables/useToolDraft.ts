import { computed, watch } from 'vue';
import { toolDraftKey, type ToolDraft } from '../lib/toolDraft.ts';

// Each control is mounted with a fresh opening baseline and unmounted after Apply/discard.
// eslint-disable-next-line no-unused-vars
export function useToolDraft(draft: () => ToolDraft, report: (dirty: boolean) => void) {
    const baseline = toolDraftKey(draft());
    const dirty = computed(() => toolDraftKey(draft()) !== baseline);
    watch(dirty, report, { immediate: true, flush: 'sync' });
    return dirty;
}
