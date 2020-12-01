<script lang="ts">
  import ipc from "../ipc";
</script>

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
<p>Hello Gallery</p>
