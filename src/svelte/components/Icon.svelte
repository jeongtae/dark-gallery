<script lang="ts">
  export let path: string;
  export let viewBoxSize: number;
  export let width: number = undefined;
  export let height: number = undefined;
  export let fill: string = undefined;
</script>

<template>
  <svg
    viewBox="0 0 {viewBoxSize} {viewBoxSize}"
    {width}
    {height}
    xmlns="http://www.w3.org/2000/svg">
    <path d={path} {fill} />
  </svg>
</template>
