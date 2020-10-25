<script lang="ts">
  import oc from "open-color";
  import TitleBar from "./TitleBar.svelte";
  import NavigationBar from "./NavigationBar.svelte";
  import type { Tabs } from "./TabBar.svelte";
  let tabs: Tabs = {
    apl: { title: "Apple", thumbnail: "apple.jpg" },
    ban: { title: "Banana", thumbnail: "banana.jpg" },
    grp: { title: "Grape", thumbnail: "grape.jpg" },
    org: { title: "Orange", thumbnail: "orange.jpg" },
    wtm: { title: "Watermelon", thumbnail: "watermelon.jpg" },
    lmn: { title: "Lemon", thumbnail: "lemon.jpg" },
    kwi: { title: "Kiwi", thumbnail: "kiwi.jpg" },
    pch: { title: "Peach", thumbnail: "peach.jpg" },
    per: { title: "Pear", thumbnail: "pear.jpg" },
  };
  let selectedTabId: string = null;
  let selectedMenu: "home" | "settings" | null = "home";

  $: {
    if (selectedMenu) {
      document.title = `${selectedMenu} \u2500 JT Gallery`;
    } else if (selectedTabId) {
      document.title = `${tabs[selectedTabId].title} \u2500 JT Gallery`;
    } else {
      document.title = "JT Gallery";
    }
  }
</script>

<svelte:head>
  <title>JT Gallery</title>
</svelte:head>
<template>
  <TitleBar color={oc.gray[9]} />
  <NavigationBar bind:tabs bind:selectedTabId bind:selectedMenu />
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
