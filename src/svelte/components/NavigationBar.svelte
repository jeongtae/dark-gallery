<script lang="ts">
  import Icon from "./Icon.svelte";
  import TabBar from "./TabBar.svelte";
  import type { Tabs } from "./TabBar.svelte";
  import { lnrHome, lnrCog } from "../svg/linearicons";

  export let selectedMenu: "home" | "settings" | null;
  export let tabs: Tabs = {};
  export let selectedTabId: string;

  $: {
    selectedMenu = selectedTabId === null ? "home" : null;
  }
</script>

<template>
  <div class="container">
    <button
      class="menu"
      class:selected={selectedMenu === 'home'}
      on:mousedown|preventDefault
      on:click={() => {
        selectedMenu = 'home';
        selectedTabId = null;
      }}
    >
      <Icon path={lnrHome} viewBoxSize={20} width={16} />
    </button>
    <div class="tabbar">
      <TabBar bind:tabs bind:selectedTabId />
    </div>
    <button
      class="menu"
      class:selected={selectedMenu === 'settings'}
      on:mousedown|preventDefault
      on:click={() => {
        selectedMenu = 'settings';
        selectedTabId = null;
      }}
    >
      <Icon path={lnrCog} viewBoxSize={20} width={16} />
    </button>
  </div>
</template>

<style lang="scss">
  @import "open-color/open-color";

  .container {
    display: flex;
    justify-content: space-between;
    background-color: $oc-gray-8;
    height: 30px;
  }

  button.menu {
    width: 40px;
    fill: $oc-gray-6;
    position: relative;
    flex-shrink: 0;
    transition: box-shadow 70ms ease-in-out;
    :global(svg) {
      transform: translateY(1px);
    }
    &.selected {
      fill: $oc-gray-0;
      background-color: $oc-gray-9;
      &::before {
        content: "";
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 2px;
        background-color: $oc-gray-0;
      }
    }
    &:hover {
      fill: $oc-gray-0;
    }
    &:focus {
      box-shadow: 0 0 0 2px $oc-gray-0 inset;
    }
  }

  .tabbar {
    flex: 1;
    overflow-x: hidden;
    display: flex;
    align-items: stretch;
  }
</style>
