<script lang="ts">
  import oc from "open-color";
  import { productName } from "../../package.json";
  import TitleBar from "./components/TitleBar.svelte";
  import NavigationBar from "./components/NavigationBar.svelte";
  import type { Tabs } from "./components/TabBar.svelte";
  import HomePage from "./pages/HomePage.svelte";
  import GalleryPage from "./pages/GalleryPage.svelte";
  import SettingsPage from "./pages/SettingsPage.svelte";
  import { currentGalleryPathStore } from "./stores";

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
    <div class="pages-container">
      <div
        class="page-wrapper"
        class:hidden={selectedMenu !== 'home'}
        tabindex={selectedMenu === 'home' ? null : -1}
      >
        {#if $currentGalleryPathStore}
          <GalleryPage />
        {:else}
          <HomePage />
        {/if}
      </div>
      <div
        class="page-wrapper"
        class:hidden={selectedMenu !== 'settings'}
        tabindex={selectedMenu === 'settings' ? null : -1}
      >
        <SettingsPage />
      </div>
    </div>
  </div>
</template>

<style lang="scss">
  @import "open-color/open-color";
  @import "./global";

  .container {
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .pages-container {
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
    &::-webkit-scrollbar {
      width: 6px;
      background-color: transparent;
    }
    &::-webkit-scrollbar-thumb {
      background-color: $oc-gray-7;
    }
  }
</style>
