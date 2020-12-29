<script lang="ts">
  const { Titlebar, Color } = require("custom-electron-titlebar");
  import { onMount } from "svelte";

  export let colorHex: string = "#fff";

  let titlebar: InstanceType<typeof Titlebar>;
  $: titlebar?.updateBackground(Color.fromHex(colorHex));

  onMount(() => {
    titlebar = new Titlebar({
      backgroundColor: Color.fromHex(colorHex),
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
