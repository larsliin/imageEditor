import { nextTick, onBeforeUnmount, onMounted, shallowRef, type Ref } from 'vue';

/**
 * Collapses when the container's content overflows its height, and expands again once the
 * container is tall enough to fit the content it had when it collapsed.
 */
export function useOverflowCollapse(container: Readonly<Ref<HTMLElement | null>>) {
    const collapsed = shallowRef(false);
    let expandedHeight = 0;
    let observer: ResizeObserver | null = null;

    function update() {
        const element = container.value;
        if (!element) return;
        if (!collapsed.value) {
            if (element.scrollHeight > element.clientHeight + 1) {
                expandedHeight = element.scrollHeight;
                collapsed.value = true;
            }
        } else if (element.clientHeight >= expandedHeight) {
            collapsed.value = false;
            void nextTick(update);
        }
    }

    onMounted(() => {
        if (!container.value) return;
        observer = new ResizeObserver(update);
        observer.observe(container.value);
        update();
    });

    onBeforeUnmount(() => observer?.disconnect());

    return { collapsed, update };
}
