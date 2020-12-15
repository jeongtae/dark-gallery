<script lang="ts">
  import { onMount } from "svelte";
  import { tweened } from "svelte/motion";

  export let selected: boolean = false;

  //#region 외부 프로퍼티
  /** Base64로 인코딩된 썸네일 문자열 */
  export let thumbnailBase64: string;
  /** 썸네일 이미지의 절대경로 */
  export let thumbnailPath: string;
  //#endregion

  //#region 내부 상태
  let containerWidth: number;
  let showThumbnail: boolean = false;
  let thumbnailOpacity = tweened(0, { duration: 300 });
  //#endregion

  onMount(() => {
    const timeout = setTimeout(async () => {
      showThumbnail = true;
    }, 200);
    return () => clearTimeout(timeout);
  });
</script>

<container bind:offsetWidth={containerWidth} on:click class:selected>
  <pad>
    {#if $thumbnailOpacity < 1}
      <base64-thumbnail style="background-image:url(data:image/webp;base64,{thumbnailBase64});" />
      <thumbnail-blurer style="backdrop-filter: blur({~~(containerWidth / 20)}px);" />
    {/if}
    {#if showThumbnail}
      <img
        class="thumbnail"
        on:load={() => ($thumbnailOpacity = 1)}
        style="opacity: {$thumbnailOpacity}"
        alt=""
        src="file://{thumbnailPath}"
      />
    {/if}
    <inner-border class:selected />
  </pad>
</container>

<style lang="scss">
  @import "open-color/open-color";

  $padding: 1px;
  container {
    display: block;
    height: 100%;
    position: relative;
    padding: $padding;
    counter-reset: zindex;
  }
  pad {
    display: block;
    width: calc(100% - #{$padding * 2});
    height: calc(100% - #{$padding * 2});
    position: absolute;
  }
  base64-thumbnail {
    position: absolute;
    width: 100%;
    height: 100%;
    background-size: cover;
    background-position: center;
    z-index: 1;
  }
  thumbnail-blurer {
    display: block;
    position: absolute;
    width: 100%;
    height: 100%;
    background: transparent;
    z-index: 2;
  }
  img.thumbnail {
    display: block;
    position: absolute;
    width: 100%;
    height: 100%;
    object-fit: cover;
    opacity: 0;
    will-change: opacity;
    z-index: 3;
  }
  inner-border {
    display: block;
    position: absolute;
    width: 100%;
    height: 100%;
    z-index: 4;
    &.selected {
      box-shadow: 0 0 0 4px $oc-blue-6 inset, 0 0 0 5px black inset;
    }
  }
</style>
