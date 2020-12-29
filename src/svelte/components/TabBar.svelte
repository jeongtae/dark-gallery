<script context="module" lang="ts">
  export interface Tab {
    /** `Tab`의 식별자 */
    id: string;
    /** 탭 제목 */
    title: string;
  }
  export interface FluidTab extends Tab {
    /** Base64 썸네일 */
    thumbnail: string;
  }
  export interface FixedTab extends Tab {
    /** 20px 사이즈의 카본 아이콘 */
    icon: typeof CarbonIcon;
  }
</script>

<script lang="ts">
  import type { CarbonIcon } from "carbon-icons-svelte";
  import { Icon } from "carbon-components-svelte";
  import Close16 from "carbon-icons-svelte/lib/Close20";

  //#region External Props

  /** 좌측에 고정되는 탭 */
  export let leftFixedTab: FixedTab;

  /** 우측에 고정되는 탭 */
  export let rightFixedTab: FixedTab;

  //#endregion

  //#region External Bindable Prop

  /** 나머지 영역에 나타나는 탭 리스트 */
  export let centerFluidTabs: FluidTab[];

  /** 선택된 탭 식별자 */
  export let selectedTabId: string = null;

  //#endregion

  //#region Local State

  /** 다른 탭이 자신 위에서 드래그 중인 탭 */
  let dragoverTabId: string = null;

  //#endregion

  /** 최근 열었던 탭 식별자 기록 */
  let selectedTabIdHistory: string[] = [];

  function memoryTabHistory(tabId: string) {
    if (centerFluidTabs.find(tab => tab.id === tabId)) {
      selectedTabIdHistory.push(tabId);
      if (selectedTabIdHistory.length > 30) {
        selectedTabIdHistory.splice(0, 1);
      }
    }
  }
  $: memoryTabHistory(selectedTabId);

  const handleTabClick: svelte.JSX.EventHandler = e => {
    const { tabId } = e.currentTarget.dataset;
    selectedTabId = tabId;
  };
  const handleTabClose: svelte.JSX.EventHandler = e => {
    const { tabId: closingTabId } = e.currentTarget.dataset;
    const closingTabIndex = centerFluidTabs.findIndex(tab => tab.id === closingTabId);
    // 현재 선택된 탭을 닫으려는 경우, 다른 탭 선택
    if (selectedTabId === closingTabId) {
      let isSolved = false;
      // 탭 히스토리에서 선택
      while (selectedTabIdHistory.length) {
        const historyTabId = selectedTabIdHistory.pop();
        if (closingTabId === historyTabId) {
          continue;
        } else if (centerFluidTabs.find(tab => tab.id === historyTabId)) {
          selectedTabId = historyTabId;
          isSolved = true;
          break;
        }
      }
      // 옆 탭을 선택
      if (!isSolved) {
        if (closingTabIndex === 0 && centerFluidTabs[1]) {
          selectedTabId = centerFluidTabs[1].id;
        } else if (centerFluidTabs[closingTabIndex - 1]) {
          selectedTabId = centerFluidTabs[closingTabIndex - 1].id;
        } else {
          selectedTabId = leftFixedTab.id || rightFixedTab.id || null;
        }
      }
    }
    // 닫으려는 탭을 탭 목록에서 제거
    centerFluidTabs.splice(closingTabIndex, 1);
    centerFluidTabs = centerFluidTabs;
  };
  const handleTabDragStart: svelte.JSX.EventHandler<DragEvent> = e => {
    const { tabId } = e.currentTarget.dataset;
    e.dataTransfer.setData("application/x-tabid", tabId);
    e.dataTransfer.effectAllowed = "copyMove";
    selectedTabId = tabId;
  };
  const handleTabDragOver: svelte.JSX.EventHandler<DragEvent> = e => {
    if (e.dataTransfer.types.includes("application/x-tabid")) {
      const { tabId } = e.currentTarget.dataset;
      if (selectedTabId !== tabId) {
        dragoverTabId = tabId;
        e.dataTransfer.dropEffect = "move";
        e.preventDefault();
      }
    }
  };
  const handleTabDragLeave: svelte.JSX.EventHandler<DragEvent> = e => {
    dragoverTabId = null;
  };
  const handleTabDrop: svelte.JSX.EventHandler<DragEvent> = e => {
    dragoverTabId = null;
    const sourceTabId = e.dataTransfer.getData("application/x-tabid");
    const targetTabId = e.currentTarget.dataset.tabId;
    let sourceTabIndex = centerFluidTabs.findIndex(tab => tab.id === sourceTabId);
    let targetTabIndex = centerFluidTabs.findIndex(tab => tab.id === targetTabId);
    const [sourceTab] = centerFluidTabs.splice(sourceTabIndex, 1);
    centerFluidTabs.splice(targetTabIndex, 0, sourceTab);
    centerFluidTabs = centerFluidTabs;
  };
</script>

<tb-container>
  {#if leftFixedTab}
    <button
      class="fixed-tab"
      class:selected={selectedTabId === leftFixedTab.id}
      data-tab-id={leftFixedTab.id}
      on:click={handleTabClick}
    ><Icon render={leftFixedTab.icon} /></button>
  {/if}
  {#if centerFluidTabs}
    <tb-fluid-tabs-container>
      {#each centerFluidTabs as tab (tab.id)}
        <button
          class="fluid-tab"
          class:selected={selectedTabId === tab.id}
          class:drag-over={dragoverTabId === tab.id}
          data-tab-id={tab.id}
          on:click={handleTabClick}
          draggable={true}
          on:dragstart={handleTabDragStart}
          on:dragover={handleTabDragOver}
          on:dragleave={handleTabDragLeave}
          on:drop={handleTabDrop}
        >
          {#if tab.thumbnail}
            <div class="thumbnail" />
          {/if}
          <span class="title">{tab.title}</span>
          <button
            class="close"
            data-tab-id={tab.id}
            on:mousedown|preventDefault
            on:click|stopPropagation={handleTabClose}
          >
            <Icon render={Close16} />
          </button>
        </button>
      {/each}
    </tb-fluid-tabs-container>
  {/if}
  {#if rightFixedTab}
    <button
      class="fixed-tab"
      class:selected={selectedTabId === rightFixedTab.id}
      data-tab-id={rightFixedTab.id}
      on:click={handleTabClick}
    ><Icon render={rightFixedTab.icon} /></button>
  {/if}
</tb-container>

<style lang="scss">
  @import "../utils";

  button {
    @include transition(box-shadow, color);
  }

  tb-container {
    display: flex;
    justify-content: space-between;
    background-color: $oc-gray-8;
    height: 30px;
  }

  button.fixed-tab {
    width: 40px;
    color: $oc-gray-6;
    flex-shrink: 0;
    position: relative;
    :global(svg) {
      transform: translateY(1px) scale(0.9);
    }
    &:hover,
    &:focus {
      color: $oc-gray-2;
    }
    &.selected {
      color: $oc-gray-0;
      background-color: $oc-gray-9;
      box-shadow: 0 2px $oc-gray-0 inset;
    }
    &:focus {
      @include shadow-border;
    }
  }

  tb-fluid-tabs-container {
    display: flex;
    align-items: stretch;
    overflow-x: scroll;
    flex: 1;
    &::-webkit-scrollbar {
      height: 0;
    }
  }

  button.fluid-tab {
    flex: 1;
    background-color: $oc-gray-7;
    min-width: 80px;
    max-width: 160px;
    padding: 0 6px;
    border-right: 1px solid $oc-gray-9;
    display: flex;
    align-items: center;
    &:focus {
      @include shadow-border;
    }
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
      @include transition(color);
    }
    .close {
      position: absolute;
      color: $oc-gray-6;
      border-radius: 4px;
      width: 16px;
      height: 16px;
      transition: unset;
      :global(svg) {
        transform: translate(-2px, -2px) scale(0.875);
      }
      &:hover {
        background-color: $oc-gray-8;
      }
      &:focus {
        position: static;
        box-shadow: 0 0 0 2px $oc-gray-0;
        transition: inherit;
      }
      &:active {
        opacity: 0.5;
      }
    }
    &:focus .close {
      position: static;
      transition: inherit;
    }
    &:last-child {
      border-right: none;
    }
    &:hover {
      .title {
        color: $oc-gray-5;
      }
      .close {
        position: static;
      }
    }
    &.selected {
      background-color: $oc-gray-9;
      .title {
        color: $oc-gray-4;
      }
      .close {
        position: static;
        color: $oc-gray-4;
      }
    }
    &.drag-over {
      background-color: $oc-gray-8;
    }
  }
</style>
