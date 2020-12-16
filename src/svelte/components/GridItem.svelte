<script lang="ts">
  import { onMount } from "svelte";
  import { tweened } from "svelte/motion";

  export let selected: boolean = false;
  export let thumbnailContain: boolean = false;

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
    }, 350);
    return () => clearTimeout(timeout);
  });
</script>

<container bind:offsetWidth={containerWidth} on:click class:selected>
  <pad>
    {#if $thumbnailOpacity < 1}
      <base64-thumbnail
        class:contain={thumbnailContain}
        style="background-image:url(data:image/webp;base64,{thumbnailBase64});"
      />
    {/if}
    {#if showThumbnail}
      <img
        class="thumbnail"
        class:contain={thumbnailContain}
        on:load={() => ($thumbnailOpacity = 1)}
        style="opacity: {$thumbnailOpacity}"
        alt=""
        src="file://{thumbnailPath}"
      />
    {/if}
    <inner-border
      class:thick={selected && containerWidth >= 150}
      class:thin={selected && containerWidth < 150}
    />
  </pad>
</container>

<style lang="scss">
  @import "open-color/open-color";

  container {
    display: block;
    height: 100%;
    position: relative;
    counter-reset: zindex;
  }
  pad {
    display: block;
    width: 100%;
    height: 100%;
    position: absolute;
  }
  base64-thumbnail {
    position: absolute;
    width: 100%;
    height: 100%;
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
    z-index: 1;
    &.contain {
      background-size: contain;
    }
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
    &.contain {
      object-fit: contain;
    }
  }
  inner-border {
    display: block;
    position: absolute;
    width: 100%;
    height: 100%;
    z-index: 4;
    &.thick {
      box-shadow: 0 0 0 4px $oc-blue-6 inset, 0 0 0 5px mix($oc-gray-9, $oc-black, 70%) inset;
    }
    &.thin {
      box-shadow: 0 0 0 3px $oc-blue-6 inset, 0 0 0 4px mix($oc-gray-9, $oc-black, 70%) inset;
    }
  }
</style>
