<script lang="ts">
  import { chunk, throttle } from "lodash";
  import { onMount, tick } from "svelte";

  //#region 외부 프로퍼티
  export let items: any[];
  export let itemKeyProp: string;
  export let height = "100%";
  export let gap = 0;
  export let throttlingTime = 20;
  //#endregion

  //#region 내부 바인딩 상태
  let containerRef: HTMLDivElement;
  let containerWidth: number;
  let containerHeight: number;
  //#endregion

  //#region 내부 상태
  let itemsPerRow = 7;
  let visibleItemStartIndex = 0;
  let visibleItemEndIndex = 0;
  let mounted: boolean;
  onMount(async () => (mounted = true));
  //#endregion

  //#region 반응형 상태
  let itemSize: number;
  const refreshItemSize = throttle((containerWidth, itemsPerRow) => {
    itemSize = ~~((containerWidth + gap) / itemsPerRow - gap);
    if (mounted) handleScroll();
  }, throttlingTime);
  $: refreshItemSize(containerWidth, itemsPerRow);
  $: scrollHeight = Math.max(0, (itemSize + gap) * Math.ceil(items.length / itemsPerRow) - gap);
  $: visibleItems = items.slice(visibleItemStartIndex, visibleItemEndIndex);
  $: gridOffsetY = (visibleItemStartIndex / itemsPerRow) * (itemSize + gap);
  //#endregion

  //#region 이벤트 핸들러
  function handleScroll() {
    const { scrollTop } = containerRef;
    const visibleRowStartIndex = ~~(scrollTop / (itemSize + gap));
    const visibleRowEndIndex = ~~((scrollTop + containerHeight + 1) / (itemSize + gap));
    visibleItemStartIndex = Math.max(0, (visibleRowStartIndex - 2) * itemsPerRow);
    visibleItemEndIndex = (visibleRowEndIndex + 3) * itemsPerRow;
  }
  const handleWheel = throttle<svelte.JSX.WheelEventHandler<HTMLDivElement>>(
    async e => {
      if (e.ctrlKey) {
        const ratio = containerRef.scrollTop / (scrollHeight - containerHeight);
        if (e.deltaY < 0 && itemsPerRow > 5) {
          itemsPerRow -= 1;
          await tick();
          containerRef.scrollTop = ratio * (scrollHeight - containerHeight);
        } else if (e.deltaY > 0 && itemsPerRow < 9) {
          itemsPerRow += 1;
          await tick();
          containerRef.scrollTop = ratio * (scrollHeight - containerHeight);
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
  <vg-scroll-area style="height: {scrollHeight}px">
    <vg-grid
      style="
        grid: auto-flow {itemSize}px / repeat({itemsPerRow}, {itemSize}px);
        gap: {gap}px;
        transform: translateY({gridOffsetY}px);
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
