<script lang="ts">
  const { Titlebar, Color } = require("custom-electron-titlebar");
  import { onMount } from "svelte";

  onMount(() => {
    new Titlebar({
      backgroundColor: Color.fromHex("#444"),
    });
  });
</script>

<svelte:head>
  <title>Hello</title>
</svelte:head>
<template>
  <div />
</template>

<style lang="scss">
</style>
