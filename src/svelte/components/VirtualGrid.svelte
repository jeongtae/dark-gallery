<script lang="ts">
  import { throttle } from "lodash";
  import { onMount, tick } from "svelte";

  //#region 외부 프로퍼티
  export let items: any[];
  export let itemKeyProp: string;
  export let height = "100%";
  export let paddingSide = 0;
  export let paddingTop = 0;
  export let paddingBottom = 0;
  export let gap = 0;
  //#endregion

  //#region 외부 바인드 프로퍼티
  export let itemsPerRow = 7;
  export let minItemsPerRow = 5;
  export let maxItemsPerRow = 8;
  //#endregion

  //#region 로컬 바인드 상태
  let containerRef: HTMLDivElement;
  let containerWidth: number;
  let containerHeight: number;
  //#endregion

  //#region 로컬 상태
  let visibleItemStartIndex = 0;
  let visibleItemEndIndex = 0;
  let mounted: boolean;
  //#endregion

  onMount(async () => (mounted = true));

  //#region 반응형 상태
  $: if (mounted && itemSize) handleScroll();
  $: itemSize = (containerWidth - paddingSide * 2 + gap) / itemsPerRow - gap;
  $: scrollAreaHeight =
    Math.max(0, (itemSize + gap) * Math.ceil(items.length / itemsPerRow) - gap) +
    paddingTop +
    paddingBottom;
  $: scrollEnd = scrollAreaHeight - containerHeight;
  $: visibleItems = items.slice(visibleItemStartIndex, visibleItemEndIndex);
  $: gridTranslateY = (visibleItemStartIndex / itemsPerRow) * (itemSize + gap) + paddingTop;
  //#endregion

  //#region 이벤트 핸들러
  function handleScroll() {
    const { scrollTop } = containerRef;
    const visibleRowStartIndex = ~~((scrollTop - paddingTop) / (itemSize + gap));
    const visibleRowEndIndex = ~~(
      (scrollTop - paddingTop + containerHeight + 1) /
      (itemSize + gap)
    );
    visibleItemStartIndex = Math.max(0, (visibleRowStartIndex - 3) * itemsPerRow);
    visibleItemEndIndex = (visibleRowEndIndex + 4) * itemsPerRow;
  }
  const handleWheel = throttle<svelte.JSX.WheelEventHandler<HTMLDivElement>>(
    async ({ ctrlKey, deltaY }) => {
      if (ctrlKey) {
        const ratio = containerRef.scrollTop / scrollEnd;
        if (deltaY < 0 && itemsPerRow > minItemsPerRow) {
          itemsPerRow -= 1;
          await tick();
          containerRef.scrollTop = ratio * scrollEnd;
        } else if (deltaY > 0 && itemsPerRow < maxItemsPerRow) {
          itemsPerRow += 1;
          await tick();
          containerRef.scrollTop = ratio * scrollEnd;
        }
      }
    },
    300,
    { trailing: false }
  );
  //#endregion
</script>

<vg-container
  bind:this={containerRef}
  bind:offsetWidth={containerWidth}
  bind:offsetHeight={containerHeight}
  on:scroll={handleScroll}
  on:wheel={handleWheel}
  style="height: {height};"
>
  <vg-scroll-area style="height: {scrollAreaHeight}px;">
    <vg-grid
      style="
        grid: auto-flow {itemSize}px / repeat({itemsPerRow}, {itemSize}px);
        gap: {gap}px;
        transform: translate({paddingSide}px, {gridTranslateY}px);
      "
    >
      {#each visibleItems as item (item[itemKeyProp])}
        <vg-item-wrapper>
          <slot {item} />
        </vg-item-wrapper>
      {/each}
    </vg-grid>
  </vg-scroll-area>
</vg-container>

<style>
  vg-container {
    display: block;
    position: relative;
    z-index: 1;
    overflow-y: scroll;
    overscroll-behavior-y: none;
    user-select: none;
  }
  vg-scroll-area {
    display: block;
    width: 0;
    will-change: height;
  }
  vg-grid {
    display: grid;
    will-change: grid, transform;
  }
  vg-item-wrapper {
    display: block;
    will-change: width, height;
    overflow: hidden;
  }
</style>
