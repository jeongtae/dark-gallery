<script>
  import { onMount } from "svelte";
  import { throttle } from "lodash";

  export let sidebarWidth = 200;
  export let sidebarMinWidth = 100;
  export let sidebarMaxWidth = 300;
  let containerRef, sidebarRef;

  let draggable = false;
  let dragging = false;

  $: if (containerRef) {
    containerRef.style.cursor = draggable || dragging ? "col-resize" : "auto";
  }
  $: if (sidebarRef) {
    sidebarRef.style.width = `${sidebarWidth}px`;
  }
  onMount(() => {
    sidebarRef.style.width = `${sidebarWidth}px`;
  });

  function handleMouseMove({ clientX }) {
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
  }
  const throttledHandleMouseMove = throttle(handleMouseMove, 20);

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
  on:mousemove={throttledHandleMouseMove}
  on:mousedown={handleMouseDown}
  on:mouseup={handleMouseUp}
  on:mouseleave={handleMouseUp}
>
  <div class="sidebar" bind:this={sidebarRef}>
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
