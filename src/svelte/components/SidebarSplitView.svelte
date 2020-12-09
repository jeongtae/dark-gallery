<script>
  import { onMount } from "svelte";
  import { throttle } from "lodash";

  export let sidebarWidth = 200;
  export let sidebarMinWidth = 100;
  export let sidebarMaxWidth = 300;
  export let throttling = 20;

  let containerRef;
  let draggable = false;
  let dragging = false;
  let mounted = false;
  onMount(() => (mounted = true));

  $: containerCursor = draggable || dragging ? "col-resize" : "auto";

  const handleMouseMove = throttle(({ clientX }) => {
    if (!mounted) return;
    const { left } = containerRef.getBoundingClientRect();
    const localX = clientX - left;
    const diff = Math.abs(localX - sidebarWidth);
    draggable = diff < 5;
    if (dragging) {
      let newWidth = localX;
      newWidth = Math.min(newWidth, sidebarMaxWidth);
      newWidth = Math.max(newWidth, sidebarMinWidth);
      newWidth = Math.round(newWidth);
      sidebarWidth = newWidth;
    }
  }, throttling);

  function handleMouseDown(e) {
    if (draggable) {
      dragging = true;
      e.preventDefault();
    }
  }

  function handleMouseUp(e) {
    if (dragging) {
      dragging = false;
      e.preventDefault();
    }
  }
</script>

<div
  class="container"
  bind:this={containerRef}
  on:mousemove={handleMouseMove}
  on:mousedown={handleMouseDown}
  on:mouseup={handleMouseUp}
  on:mouseleave={handleMouseUp}
  style="cursor: {containerCursor};"
>
  <div class="sidebar" style="width: {sidebarWidth}px;">
    <slot name="sidebar" />
  </div>
  <div class="main">
    <slot />
  </div>
</div>

<style>
  .container {
    width: 100%;
    height: 100%;
    display: flex;
  }
  .main {
    flex: 1;
  }
</style>
