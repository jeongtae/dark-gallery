<script lang="ts">
  const { Titlebar, Color } = require("custom-electron-titlebar");
  import { onMount } from "svelte";
  import Link from "./Link.svelte";

  export let name: string;

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
  <main>
    <h1>Hello {name}!</h1>
    <p>
      Visit the
      <Link href="https://svelte.dev/tutorial">Svelte tutorial</Link>
      to learn how to build Svelte apps.
    </p>
  </main>
</template>

<style lang="scss">
  main {
    text-align: center;
    padding: 1em;
    max-width: 240px;
    margin: 0 auto;
    @media (min-width: 640px) {
      max-width: none;
    }
  }
  h1 {
    color: #ff3e00;
    text-transform: uppercase;
    font-size: 4em;
    font-weight: 100;
  }
</style>
