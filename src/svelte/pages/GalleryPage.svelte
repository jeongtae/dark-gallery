<script lang="ts">
  import ipc from "../ipc";
  import SidebarSplitView from "../components/SidebarSplitView.svelte";
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
        console.dir(await ipc.invoke('getItems'));
      }}
    >Get Items</button>
  </div>
  <div class="main">This is main</div>
</SidebarSplitView>

<style lang="scss">
  @import "open-color/open-color";

  .main {
    height: 100%;
    background: mix($oc-gray-9, $oc-black, 70%);
  }
</style>
