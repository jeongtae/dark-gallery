<script lang="ts">
  import type { RawItem } from "../../common/sequelize";
  import oc from "open-color";
  import { onMount } from "svelte";
  import { fade, fly } from "svelte/transition";
  import { Icon, Button } from "carbon-components-svelte";
  import Filter24 from "carbon-icons-svelte/lib/Filter24";
  import InformationSquare24 from "carbon-icons-svelte/lib/InformationSquare24";
  import CaretLeft16 from "carbon-icons-svelte/lib/CaretLeft16";
  import CaretRight16 from "carbon-icons-svelte/lib/CaretRight16";
  import PageLast24 from "carbon-icons-svelte/lib/PageLast24";
  import PageFirst24 from "carbon-icons-svelte/lib/PageFirst24";
  import ZoomIn24 from "carbon-icons-svelte/lib/ZoomIn24";
  import ZoomOut24 from "carbon-icons-svelte/lib/ZoomOut24";
  import Minimize16 from "carbon-icons-svelte/lib/Minimize16";
  import Maximize16 from "carbon-icons-svelte/lib/Maximize16";
  import TrashCan24 from "carbon-icons-svelte/lib/TrashCan24";
  import Favorite24 from "carbon-icons-svelte/lib/Favorite24";
  import Close24 from "carbon-icons-svelte/lib/Close24";
  import Renew20 from "carbon-icons-svelte/lib/Renew20";
  import ChevronRight20 from "carbon-icons-svelte/lib/ChevronRight20";
  import { ipc } from "../ipc";
  import { path as nodePath } from "../node";
  import { currentGalleryPath } from "../stores";
  import VirtualGrid from "../components/VirtualGrid.svelte";
  import GridItem from "../components/GridItem.svelte";

  onMount(async () => {
    items = await ipc.invoke("getItems");
    console.dir(items);
  });

  let showFilterSidebar = false;
  let showDetailSidebar = false;

  let items: RawItem[] = [];
  let selectedItemKeys: Set<string> = new Set();

  let gridItemFitCoverMode = true;
  let gridItemsPerRow = 7;
  let gridItemsPerRowMin = 5;
  let gridItemsPerRowMax = 8;

  const controlButtonClickHandlers = {
    openFilterSidebar() {
      showFilterSidebar = true;
    },
    openDetailSidebar() {
      showDetailSidebar = true;
    },
    zoomIn() {
      if (gridItemsPerRow > gridItemsPerRowMin) {
        gridItemsPerRow -= 1;
      }
    },
    zoomOut() {
      if (gridItemsPerRow < gridItemsPerRowMax) {
        gridItemsPerRow += 1;
      }
    },
    toggleFitCover() {
      gridItemFitCoverMode = !gridItemFitCoverMode;
    },
    toggleSelectedItemsFavorite() {
      console.error("NOT IMPLEMENTED");
    },
    deleteSelectedItems() {
      console.error("NOT IMPLEMENTED");
    },
    deselectAllItem() {
      selectedItemKeys.clear();
      selectedItemKeys = selectedItemKeys;
    },
  };
  const filterSidebarButtonClickHandlers = {
    close() {
      showFilterSidebar = false;
    },
  };
  const detailSidebarButtonClickHandlers = {
    close() {
      showDetailSidebar = false;
    },
  };
  function startIndexing() {
    ipc.invoke("startGalleryIndexing");
  }

  async function getItems() {
    items = await ipc.invoke("getItems");
    console.dir(items);
  }
</script>

<page-split-view>
  <!-- FILTER SIDEBAR-->
  {#if showFilterSidebar}
    <page-split-side style="width: 250px" in:fly={{ x: -250 }}>
      <page-filter-sidebar>
        <page-sidebar-header>
          <page-flex style="align-items: center;">
            <Icon render={Filter24} />
            <span style="margin: 0 4px; font-weight: 500; font-size: 1.4rem;">필터</span>
          </page-flex>
          <button class="close" on:click={filterSidebarButtonClickHandlers.close}>
            <Icon render={PageFirst24} />
          </button>
        </page-sidebar-header>
        <button on:click={startIndexing}>START INDEXING</button>
        <button on:click={getItems}>GET ITEMS</button>
        CONTENTS AREA
      </page-filter-sidebar>
    </page-split-side>
  {/if}
  <page-split-main>
    <!-- MAIN - CONTROL BAR -->
    <page-control-bar class="top" in:fade={{ delay: 500, duration: 200 }}>
      <page-flex style="justify-content: space-between">
        <!-- CONTROL BAR - LEFT SIDE -->
        <page-flex>
          {#if !showFilterSidebar}
            <page-control-strip class="left-collapsed">
              <button
                style="width: auto; padding-left: 5px;"
                on:click={controlButtonClickHandlers.openFilterSidebar}
              >
                <Icon render={Filter24} />
                <Icon render={CaretRight16} />
              </button>
            </page-control-strip>
          {/if}
          <page-control-strip style="margin-left: 12px">
            <button on:click={controlButtonClickHandlers.zoomOut}>
              <Icon render={ZoomOut24} />
            </button>
            <page-control-strip-split />
            <button on:click={controlButtonClickHandlers.zoomIn}>
              <Icon render={ZoomIn24} />
            </button>
          </page-control-strip>
          <page-control-strip style="margin-left: 12px; position: relative;">
            <button on:click={controlButtonClickHandlers.toggleFitCover}>
              <div
                style="
                    position: absolute;
                    box-shadow: 0 0 0 1.5px {oc.white};
                    border-radius: 1.5px;
                    width: {57}%; height: {57}%;"
              />
              <Icon render={gridItemFitCoverMode ? Minimize16 : Maximize16} />
            </button>
          </page-control-strip>
        </page-flex>
        <!-- CONTROL BAR - RIGHT SIDE -->
        <page-flex style="flex: 1; justify-content: flex-end;">
          <div style="position: relative; flex: 1;">
            {#if selectedItemKeys && selectedItemKeys.size > 0}
              <page-control-strip
                style="position: absolute; right: 12px;"
                in:fade={{ delay: 200, duration: 200 }}
                out:fade={{ duration: 200 }}
              >
                <span>{selectedItemKeys.size}개 선택됨</span>
                <page-control-strip-split />
                <button on:click={controlButtonClickHandlers.toggleSelectedItemsFavorite}>
                  <div class="not-hover">
                    <Icon render={Favorite24} />
                  </div>
                  <div class="hover" style="color: {oc.pink[6]};">
                    <Icon render={Favorite24} />
                  </div>
                </button>
                <page-control-strip-split />
                <button on:click={controlButtonClickHandlers.deleteSelectedItems}>
                  <div class="not-hover">
                    <Icon render={TrashCan24} />
                  </div>
                  <div class="hover" style="color: {oc.red[7]};">
                    <Icon render={TrashCan24} />
                  </div>
                </button>
                <page-control-strip-split />
                <button on:click={controlButtonClickHandlers.deselectAllItem}>
                  <Icon render={Close24} />
                </button>
              </page-control-strip>
            {:else}
              <page-control-strip
                class="transparent"
                style="position: absolute; right: 12px; pointer-events: none;"
                in:fade={{ delay: 200, duration: 200 }}
                out:fade={{ duration: 200 }}
              >
                <span>{#if items?.length}{items.length}개의 항목{:else}항목 없음{/if}</span>
              </page-control-strip>
            {/if}
          </div>
          {#if !showDetailSidebar}
            <page-control-strip class="right-collapsed">
              <button
                style="width: auto; padding-right: 5px;"
                on:click={controlButtonClickHandlers.openDetailSidebar}
              >
                <Icon render={CaretLeft16} />
                <Icon render={InformationSquare24} />
              </button>
            </page-control-strip>
          {/if}
        </page-flex>
      </page-flex>
    </page-control-bar>
    <!-- MAIN - GALLERY GRID -->
    <div style="height: 100%">
      <VirtualGrid
        {items}
        itemKeyProp="id"
        gap={2}
        bind:itemsPerRow={gridItemsPerRow}
        minItemsPerRow={gridItemsPerRowMin}
        maxItemsPerRow={gridItemsPerRowMax}
        paddingSide={2}
        paddingTop={50}
        paddingBottom={2}
        let:item
      >
        <GridItem
          on:click={() => {
            if (selectedItemKeys.has(item.id)) {
              selectedItemKeys.delete(item.id);
              selectedItemKeys = selectedItemKeys;
            } else {
              selectedItemKeys = selectedItemKeys;
              selectedItemKeys.add(item.id);
            }
          }}
          selected={selectedItemKeys.has(item.id)}
          selectedItemBorderMode={gridItemsPerRow > 5 ? 'thin' : 'normal'}
          thumbnailBase64={item.thumbnailBase64}
          thumbnailPath={nodePath.join($currentGalleryPath, item.thumbnailPath)}
          thumbnailAspect={item.width / item.height}
          thumbnailFitMode={gridItemFitCoverMode ? 'cover' : 'contain'}
        />
      </VirtualGrid>
    </div>
    <!-- MAIN - CONTROL BAR -->
    <page-control-bar class="bottom" in:fade={{ delay: 500, duration: 200 }}>
      <page-flex style="width: 100%; justify-content: center;">
        <page-control-strip>
          <button
            class="flex-style"
            style="padding: 0 4px 0 10px"
            in:fade={{ delay: 1000, duration: 200 }}
            out:fade={{ delay: 200, duration: 200 }}
          >
            <page-flex class="spin" style="align-items: center">
              <Icon render={Renew20} />
            </page-flex>
            <!-- TODO: Renew에 돌아가는 클래스 추가 또는 스벨트 애니메이션 추가 -->
            <!-- TODO: 이 버튼에 등장 애니메이션 추가 -->
            <span style="margin-left: 6px">파일 인덱싱 중</span>
            <Icon render={ChevronRight20} />
          </button>
        </page-control-strip>
      </page-flex>
    </page-control-bar>
  </page-split-main>
  <!-- DETAIL SIDEBAR-->
  {#if showDetailSidebar}
    <page-split-side class="dark" style="width: 250px" in:fly={{ x: 250 }}>
      <page-detail-sidebar>
        <page-sidebar-header>
          <button class="close" on:click={detailSidebarButtonClickHandlers.close}>
            <Icon render={PageLast24} />
          </button>
        </page-sidebar-header>
        CONTENTS AREA
      </page-detail-sidebar>
    </page-split-side>
  {/if}
</page-split-view>

<style lang="scss">
  @import "open-color/open-color";

  $grid-back-color: mix($oc-gray-9, $oc-black, 70%);
  $control-bar-height: 50px;
  $transition-duration: 120ms;
  $button-back-color: rgba($grid-back-color, 50%);
  $button-back-color-hover: rgba(scale-color($grid-back-color, $lightness: 50%), 25%);

  page-split-view {
    height: 100%;
    overflow: hidden;
    display: flex;
    background-color: $grid-back-color;
    page-split-side {
      background-color: $oc-gray-9;
      display: block;
      &.dark {
        background-color: inherit;
      }
    }
    page-split-main {
      flex: 1;
      display: block;
      position: relative;
    }
  }

  page-control-bar {
    position: absolute;
    left: 0;
    right: 0;
    height: 100px;
    z-index: 5;
    padding: 8px 0;
    background-blend-mode: darken;
    pointer-events: none;
    &.top {
      display: block;
      width: 100%;
      height: 100px;
      background: linear-gradient(rgba($grid-back-color, 50%), transparent 50%);
    }
    &.bottom {
      display: flex;
      align-items: flex-end;
      bottom: 0;
      background: linear-gradient(transparent 50%, rgba($grid-back-color, 50%));
    }
  }

  page-control-strip {
    display: flex;
    border-radius: 5px;
    backdrop-filter: blur(4px);
    pointer-events: auto;
    user-select: none;
    overflow: hidden;
    &.left-collapsed {
      border-radius: 0 5px 5px 0;
    }
    &.right-collapsed {
      border-radius: 5px 0 0 5px;
    }
    > * {
      display: flex;
      justify-content: center;
      align-items: center;
      height: 34px;
      padding: 0 12px;
      font-weight: 600;
      color: $oc-gray-0;
      background-color: $button-back-color;
      transition: background-color $transition-duration ease-in-out;
    }
    > button {
      width: 34px;
      padding: 0;
      position: relative;
      &.flex-style {
        display: flex;
        align-items: center;
        width: unset;
      }
      .not-hover,
      .hover {
        position: absolute;
        transition: opacity $transition-duration ease-in-out;
      }
      .hover {
        opacity: 0;
      }
      &:hover {
        background-color: $button-back-color-hover;
        .not-hover {
          opacity: 0;
        }
        .hover {
          opacity: 1;
        }
      }
    }
    > page-control-strip-split {
      width: 1px;
      padding: 0;
      background-color: scale-color($button-back-color, $alpha: -50%);
    }
    &.transparent {
      backdrop-filter: unset;
      > * {
        background-color: unset;
      }
      // > button:hover {
      //   background-color: unset;
      // }
      > span {
        text-shadow: 0 0 6px $oc-black;
      }
    }
  }

  page-sidebar-header {
    height: $control-bar-height;
    display: flex;
    align-items: center;
    padding: 0 12px;
    justify-content: space-between;
    button.close {
      width: 34px;
      height: 34px;
      color: $oc-white;
      border-radius: 5px;
      transition: background-color $transition-duration ease-in-out;
      &:hover {
        background-color: $button-back-color-hover;
      }
    }
  }
  page-filter-sidebar {
  }

  page-detail-sidebar {
  }

  page-flex {
    display: flex;
  }

  .spin {
    animation: spin infinite 2.5s linear;
    @keyframes spin {
      from {
        transform: rotate(360deg);
      }
      to {
        transform: rotate(0deg);
      }
    }
  }
</style>
