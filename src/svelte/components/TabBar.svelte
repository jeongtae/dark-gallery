<script context="module" lang="ts">
  export interface Tab {
    title: string;
    thumbnail: string;
  }
  export interface Tabs {
    [id: string]: Tab;
  }
</script>

<script lang="ts">
  import { difference, intersection } from "lodash";
  import { onMount } from "svelte";
  import { Icon } from "carbon-components-svelte";
  import Close16 from "carbon-icons-svelte/lib/Close20";

  export let tabs: Tabs = {};
  export let selectedTabId: string = null;
  let orderedTabIds: string[] = [];
  let selectedTabIdHistory: string[] = [];
  let dragoverTabId: string = null;
  let container: HTMLDivElement;

  $: {
    // Saving a history of the selected tab
    selectedTabId && selectedTabIdHistory.push(selectedTabId);
    selectedTabIdHistory.length > 30 && selectedTabIdHistory.splice(0, 1);
  }

  $: {
    // Ordering tab ids
    const tabIds = Object.keys(tabs);
    const intersectingTabIds = intersection(orderedTabIds, tabIds);
    const newTabIds = difference(tabIds, orderedTabIds);
    orderedTabIds = intersectingTabIds.concat(newTabIds);
  }

  onMount(() => {
    const listener = (e: WheelEvent) => {
      if (e.deltaX === 0 && container.contains(e.target as Node)) {
        container.scrollLeft += e.deltaY;
      }
    };
    window.addEventListener("mousewheel", listener);
    return () => {
      window.removeEventListener("mousewheel", listener);
    };
  });

  const handleTabClick: svelte.JSX.EventHandler = e => {
    const tabId = e.currentTarget.dataset.tabid as string;
    selectedTabId = tabId;
  };

  const handleTabClose: svelte.JSX.EventHandler = e => {
    const tabId = e.currentTarget.dataset.tabid as string;
    const tabIndex = orderedTabIds.indexOf(tabId);
    delete tabs[tabId];
    tabs = tabs;
    if (selectedTabId === tabId) {
      while (selectedTabIdHistory.length) {
        const poppedTabId = selectedTabIdHistory.pop();
        if (orderedTabIds.includes(poppedTabId) && selectedTabId !== poppedTabId) {
          selectedTabId = poppedTabId;
          break;
        }
      }
      if (selectedTabId === tabId) {
        if (tabIndex < orderedTabIds.length - 1) {
          selectedTabId = orderedTabIds[tabIndex + 1];
        } else if (tabIndex > 0) {
          selectedTabId = orderedTabIds[tabIndex - 1];
        } else {
          selectedTabId = null;
        }
      }
    }
  };

  type DragEventHandler = svelte.JSX.EventHandler<DragEvent>;
  const handleTabDragStart: DragEventHandler = e => {
    const tabId = e.currentTarget.dataset.tabid as string;
    e.dataTransfer.setData("application/x-tabid", tabId);
    e.dataTransfer.effectAllowed = "copyMove";
    selectedTabId = tabId;
  };
  const handleTabDragOver: DragEventHandler = e => {
    if (e.dataTransfer.types.includes("application/x-tabid")) {
      const tabId = e.currentTarget.dataset.tabid as string;
      if (selectedTabId !== tabId) {
        dragoverTabId = tabId;
        e.dataTransfer.dropEffect = "move";
        e.preventDefault();
      }
    }
  };
  const handleTabDragLeave: DragEventHandler = e => {
    dragoverTabId = null;
  };
  const handleTabDrop: DragEventHandler = e => {
    dragoverTabId = null;
    const sourceTabId = e.dataTransfer.getData("application/x-tabid");
    const targetTabId = e.currentTarget.dataset.tabid as string;
    let sourceTabIndex = orderedTabIds.indexOf(sourceTabId);
    let targetTabIndex = orderedTabIds.indexOf(targetTabId);
    orderedTabIds.splice(sourceTabIndex, 1);
    orderedTabIds.splice(targetTabIndex, 0, sourceTabId);
    orderedTabIds = orderedTabIds;
  };
</script>

<template>
  <div class="container" bind:this={container}>
    {#each orderedTabIds as tabId (tabId)}
      <button
        class="tab"
        class:selected={tabId === selectedTabId}
        class:dragover={tabId === dragoverTabId}
        tabindex={-1}
        draggable={true}
        on:dragstart={handleTabDragStart}
        on:dragover={handleTabDragOver}
        on:dragleave={handleTabDragLeave}
        on:drop={handleTabDrop}
        data-tabid={tabId}
        on:click={handleTabClick}
      >
        {#if tabs[tabId].thumbnail}
          <div class="thumbnail" />
        {/if}
        <span class="title">{tabs[tabId].title}</span>
        <button
          class="close"
          tabindex={-1}
          data-tabid={tabId}
          on:click|stopPropagation={handleTabClose}
        >
          <Icon render={Close16} />
        </button>
      </button>
    {/each}
  </div>
</template>

<style lang="scss">
  @import "open-color/open-color";

  .container {
    display: flex;
    align-items: stretch;
    overflow-x: scroll;
    width: 100%;
    &::-webkit-scrollbar {
      height: 0;
    }
  }

  button.tab {
    flex: 1;
    background-color: $oc-gray-7;
    min-width: 80px;
    max-width: 160px;
    padding: 0 6px;
    border-right: 1px solid $oc-gray-9;
    display: flex;
    align-items: center;
    .thumbnail {
      width: 18px;
      height: 18px;
      border-radius: 4px;
      background-color: $oc-gray-6;
      margin-right: 6px;
      pointer-events: none;
    }
    .title {
      flex: 1;
      overflow-x: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      text-align: start;
      font-size: 0.8rem;
      color: $oc-gray-6;
      pointer-events: none;
    }
    .close {
      display: none;
      color: $oc-gray-6;
      border-radius: 4px;
      width: 16px;
      height: 16px;
      :global(svg) {
        transform: translate(-2px, -2px) scale(0.875);
      }
      &:hover {
        background-color: $oc-gray-8;
      }
      &:active {
        opacity: 0.5;
      }
    }
    &:last-child {
      border-right: none;
    }
    &:hover {
      .title {
        color: $oc-gray-5;
      }
      .close {
        display: block;
      }
    }
    &.selected {
      background-color: $oc-gray-9;
      .title {
        color: $oc-gray-4;
      }
      .close {
        display: block;
        color: $oc-gray-4;
      }
    }
    &.dragover {
      background-color: $oc-gray-8;
    }
  }
</style>
