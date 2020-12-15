<script lang="ts">
  import { chunk, throttle } from "lodash";
  import { onMount, tick } from "svelte";

  //#region 외부 프로퍼티
  export let items: any[];
  export let itemKeyProp: string;
  export let height = "100%";
  export let throttling = 20;
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
    itemSize = Math.round(containerWidth / itemsPerRow);
    if (mounted) handleScroll();
  }, throttling);
  $: refreshItemSize(containerWidth, itemsPerRow);
  $: scrollHeight = ~~(itemSize * Math.ceil(items.length / itemsPerRow));
  $: visibleRows = chunk(items.slice(visibleItemStartIndex, visibleItemEndIndex), itemsPerRow).map(
    (items, i) => {
      return {
        key: items[0][itemKeyProp],
        items,
        offsetY: (visibleItemStartIndex / itemsPerRow + i) * itemSize,
      };
    }
  );
  //#endregion

  //#region 이벤트 핸들러
  function handleScroll() {
    const { scrollTop } = containerRef;
    const visibleRowStartIndex = ~~(scrollTop / itemSize);
    const visibleRowEndIndex = ~~((scrollTop + containerHeight + 1) / itemSize);
    visibleItemStartIndex = Math.max(0, (visibleRowStartIndex - 1) * itemsPerRow);
    visibleItemEndIndex = (visibleRowEndIndex + 2) * itemsPerRow;
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

<container
  bind:this={containerRef}
  bind:offsetWidth={containerWidth}
  bind:offsetHeight={containerHeight}
  on:scroll={handleScroll}
  on:wheel={handleWheel}
  style="height: {height};"
>
  <div style="height: {scrollHeight}px">
    {#each visibleRows as { key, items, offsetY } (key)}
      <row style="transform: translateY({offsetY}px)">
        {#each items as item (item[itemKeyProp])}
          <item
            data-key={item[itemKeyProp]}
            class="item-wrapper"
            style="width: {itemSize}px; height: {itemSize}px;"
          >
            <slot {item} />
          </item>
        {/each}
      </row>
    {/each}
  </div>
</container>

<style>
  container {
    display: block;
    position: relative;
    z-index: 1;
    overflow-y: scroll;
    overscroll-behavior-y: none;
  }
  row {
    display: flex;
    position: absolute;
    will-change: transform;
  }
  item {
    display: block;
    will-change: width, height;
  }
</style>
