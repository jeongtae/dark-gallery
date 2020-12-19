<script lang="ts">
  import { onMount } from "svelte";
  import { tweened } from "svelte/motion";
  import { cubicOut } from "svelte/easing";
  import { fade } from "svelte/transition";

  const FADE_IN_DURATION = 150;
  const LOAD_DELAY = 350;
  const LOAD_FINISH_FADE_DURATION = 150;
  const FIT_CHANGING_DURATION = 150;

  //#region 외부 프로퍼티
  /** 선택 상태 */
  export let selected: boolean = false;
  /** 선택 상태의 테두리 두께*/
  export let selectedBorderMode: "normal" | "thin" | "thick" = "normal";
  /** WEBP Base64로 인코딩된 썸네일 문자열 */
  export let thumbnailBase64: string;
  /** 썸네일 이미지의 절대경로 */
  export let thumbnailPath: string;
  /** 썸네일 이미지의 비율 *(W/H)* */
  export let thumbnailAspect: number;
  /** 썸네일의 피팅 모드 */
  export let thumbnailFitMode: "contain" | "cover" = "contain";
  //#endregion

  //#region 반응형 구문
  $: thumbnailScale.set(thumbnailFitMode === "cover" ? getCoverScale(thumbnailAspect) : 1);
  //#endregion

  //#region 내부 상태
  let showThumbnail: boolean = false;
  let thumbnailOpacity = tweened(0, { duration: LOAD_FINISH_FADE_DURATION });
  let thumbnailScale = tweened(thumbnailFitMode === "cover" ? getCoverScale(thumbnailAspect) : 1, {
    duration: FIT_CHANGING_DURATION,
    easing: cubicOut,
  });
  //#endregion

  function getCoverScale(aspect: number) {
    return aspect < 1 ? 1 / aspect : aspect;
  }

  onMount(() => {
    const timeout = setTimeout(async () => {
      showThumbnail = true;
    }, LOAD_DELAY);
    return () => clearTimeout(timeout);
  });
</script>

<container in:fade={{ duration: FADE_IN_DURATION }} on:click class:selected>
  <pad>
    {#if $thumbnailOpacity < 1}
      <base64-thumbnail
        style="
          transform: scale({$thumbnailScale * 1.02});
          background-image:url(data:image/webp;base64,{thumbnailBase64});"
      />
    {/if}
    {#if showThumbnail}
      <img
        class="thumbnail"
        on:load={() => ($thumbnailOpacity = 1)}
        class:definitely-cover={$thumbnailScale === getCoverScale(thumbnailAspect)}
        style="transform: scale({$thumbnailScale}); opacity: {$thumbnailOpacity};"
        alt=""
        src="file://{thumbnailPath}"
      />
    {/if}
    {#if selected}
      <inner-border
        class:thick={selectedBorderMode === 'thick'}
        class:thin={selectedBorderMode === 'thin'}
      />
    {/if}
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
    background-size: contain;
    background-position: center;
    background-repeat: no-repeat;
    will-change: transform;
    z-index: 1;
  }
  img.thumbnail {
    display: block;
    position: absolute;
    width: 100%;
    height: 100%;
    object-fit: contain;
    opacity: 0;
    will-change: transform, opacity;
    z-index: 3;
    &.definitely-cover {
      object-fit: cover;
      transform: unset !important;
    }
  }
  inner-border {
    display: block;
    position: absolute;
    width: 100%;
    height: 100%;
    z-index: 4;
    box-shadow: 0 0 0 4px $oc-blue-6 inset, 0 0 0 5px mix($oc-gray-9, $oc-black, 70%) inset;
    &.thin {
      box-shadow: 0 0 0 3px $oc-blue-6 inset, 0 0 0 4px mix($oc-gray-9, $oc-black, 70%) inset;
    }
    &.thick {
      box-shadow: 0 0 0 5px $oc-blue-6 inset, 0 0 0 5px mix($oc-gray-9, $oc-black, 70%) inset;
    }
  }
</style>
