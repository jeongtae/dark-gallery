<script lang="ts">
  const path = require("path");
  import type { RawItem } from "../../common/sequelize";
  import ipc from "../ipc";
  import { currentGalleryInfoStore } from "../stores";
  import SidebarSplitView from "../components/SidebarSplitView.svelte";
  import VirtualGrid from "../components/VirtualGrid.svelte";
  import GridItem from "../components/GridItem.svelte";

  let items: RawItem[] = [];
  let selectedItemKeys: Set<string> = new Set();
</script>

<SidebarSplitView>
  <div slot="sidebar">
    <button
      on:click={() => {
        ipc.invoke('startIndexing');
      }}
    >Start Index</button>
    <button
      on:click={async () => {
        items = await ipc.invoke('getItems');
        console.dir(items);
      }}
    >Get Items</button>
  </div>
  <div class="main">
    <VirtualGrid {items} itemKeyProp="id" gap={2} let:item>
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
        thumbnailBase64={item.thumbnailBase64}
        thumbnailPath={path.join($currentGalleryInfoStore.path, item.thumbnailPath)}
      />
    </VirtualGrid>
  </div>
</SidebarSplitView>

<style lang="scss">
  @import "open-color/open-color";

  .main {
    height: 100%;
    background: mix($oc-gray-9, $oc-black, 70%);
  }
</style>
