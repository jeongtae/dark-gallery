<script lang="ts">
  import oc from "open-color";
  import TitleBar from "./TitleBar.svelte";
</script>
<svelte:head>
  <title>JT Gallery</title>
</svelte:head>
<template>
  <TitleBar color={oc.gray[9]} />
</template>

<style lang="scss">
  @import "open-color/open-color";

  :global(body) {
    background-color: $oc-gray-9;
    color: $oc-gray-0;
  }

  :global(button) {
    appearance: none;
    border: none;
    background-color: transparent;
    margin: 0;
    padding: 0;
    cursor: pointer;
    &:focus {
      outline: none;
    }
  }
</style>
