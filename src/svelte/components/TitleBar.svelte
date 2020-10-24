<script lang="ts">
  const { Titlebar, Color } = require("custom-electron-titlebar");
  import { onMount } from "svelte";

  export let color: string = "#fff";

  onMount(() => {
    const titlebar = new Titlebar({
      backgroundColor: Color.fromHex(color),
    });
    const observer = new MutationObserver(records => {
      titlebar.updateTitle();
    });
    observer.observe(document.querySelector("title"), { childList: true });

    return () => {
      observer.disconnect();
      titlebar.dispose();
    };
  });
</script>
