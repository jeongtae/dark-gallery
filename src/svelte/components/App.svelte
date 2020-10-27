<script lang="ts">
  import oc from "open-color";
  import { productName } from "../../../package.json";
  import TitleBar from "./TitleBar.svelte";
  import NavigationBar from "./NavigationBar.svelte";
  import HomePage from "../pages/HomePage.svelte";
  import SettingsPage from "../pages/SettingsPage.svelte";
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
    if (selectedMenu === "home") {
      document.title = `홈 \u2500 ${productName}`;
    } else if (selectedMenu === "settings") {
      document.title = `설정 \u2500 ${productName}`;
    } else if (selectedTabId) {
      document.title = `${tabs[selectedTabId].title} \u2500 ${productName}`;
    } else {
      document.title = productName;
    }
  }
</script>

<svelte:head>
  <title>{productName}</title>
</svelte:head>
<template>
  <TitleBar color={oc.gray[9]} />
  <div class="container">
    <NavigationBar bind:tabs bind:selectedTabId bind:selectedMenu />
    <div class="pages">
      <div
        class="page-wrapper"
        class:hidden={selectedMenu !== 'home'}
        tabindex={selectedMenu === 'home' ? 0 : -1}
      >
        <HomePage />
      </div>
      <div
        class="page-wrapper"
        class:hidden={selectedMenu !== 'settings'}
        tabindex={selectedMenu === 'settings' ? 0 : -1}
      >
        <SettingsPage />
      </div>
    </div>
  </div>
</template>

<style lang="scss">
  @import "open-color/open-color";
  @import "../carbon";

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

  .container {
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .pages {
    flex: 1;
    position: relative;
  }

  .page-wrapper {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    overflow-y: scroll;
    &.hidden {
      visibility: hidden;
    }
    &:focus {
      outline: none;
    }
  }
</style>
