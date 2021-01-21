<script lang="ts">
  import { onMount, createEventDispatcher } from "svelte";
  import { tweened } from "svelte/motion";
  import { cubicOut } from "svelte/easing";
  import { SkeletonPlaceholder } from "carbon-components-svelte";
  import { ipc } from "../ipc";
  import type { IpcEventListeners } from "../ipc";
  import { path as nodePath } from "../node";
  import { currentGalleryThumbnailPath } from "../stores";
  import type { RawItem } from "../../common/sequelize";

  const MICRO_THUMBNAIL_FADEIN_DURATION = 70;
  const DETAIL_REQUEST_DELAY = 100;
  const NORMAL_THUMBNAIL_LOAD_DELAY = 350;
  const NORMAL_THUMBNAIL_FADEIN_DURATION = 150;
  const FIT_MODE_CHANGING_DURATION = 150;

  //#region 외부 프로퍼티
  /** 선택 상태 */
  export let selected: boolean = false;
  /** 선택 상태의 테두리 두께*/
  export let selectedItemBorderMode: "normal" | "thin" | "thick" = "normal";
  /** 썸네일 이미지의 비율 *(W/H)* */
  export let thumbnailAspectRatio: number;
  /** 썸네일의 피팅 모드 */
  export let thumbnailFitMode: "contain" | "cover" = "contain";
  export let hash: string;
  export let lost: boolean = false;
  export let itemId: number;
  //#endregion

  //#region 반응형 구문
  $: thumbnailScale.set(thumbnailFitMode === "cover" ? getCoverScale(thumbnailAspectRatio) : 1);
  $: microThumbnailPath = nodePath.join(
    $currentGalleryThumbnailPath,
    hash.substr(0, 2),
    hash + ".micro.webp"
  );
  $: normalThumbnailPath = nodePath.join(
    $currentGalleryThumbnailPath,
    hash.substr(0, 2),
    hash + ".normal.webp"
  );
  //#endregion

  //#region 내부 상태
  let itemDetail: RawItem = null;
  let watingThumbnailCreation = false;
  let watingItemDetail = false;
  let shouldShowLoading = false;
  let shouldShowMicroThumbnail = false;
  let shouldShowNormalThumbnail = false;
  const microThumbnailOpacity = tweened(0, { duration: MICRO_THUMBNAIL_FADEIN_DURATION });
  const normalThumbnailOpacity = tweened(0, { duration: NORMAL_THUMBNAIL_FADEIN_DURATION });
  const thumbnailScale = tweened(
    thumbnailFitMode === "cover" ? getCoverScale(thumbnailAspectRatio) : 1,
    {
      duration: FIT_MODE_CHANGING_DURATION,
      easing: cubicOut,
    }
  );
  //#endregion

  //#region 이벤트 핸들러
  function handleMicroThumbnailLoad() {
    $microThumbnailOpacity = 1;

    if (!itemDetail) {
      setTimeout(() => {
        ipc.invoke("requestItemDetail", itemId);
        watingItemDetail = true;
      }, DETAIL_REQUEST_DELAY);
    }

    setTimeout(() => {
      shouldShowNormalThumbnail = true;
    }, NORMAL_THUMBNAIL_LOAD_DELAY);
  }
  function handleNormalThumbnailLoad() {
    shouldShowLoading = false;
    $normalThumbnailOpacity = 1;
  }
  function handleThumbnailError() {
    clearAllTimeout();
    shouldShowLoading = true;
    shouldShowMicroThumbnail = false;
    shouldShowNormalThumbnail = false;
    $microThumbnailOpacity = 0;
    $normalThumbnailOpacity = 0;

    ipc.invoke("requestItemThumbnailCreation", hash);
    watingThumbnailCreation = true;
  }
  //#endregion

  function getCoverScale(aspectRatio: number) {
    return aspectRatio > 1 ? aspectRatio : 1 / aspectRatio;
  }

  let _timeoutSet = new Set<number>();
  function setTimeout(callback: Function, delay: number) {
    const timeout = window.setTimeout(() => {
      _timeoutSet.delete(timeout);
      callback();
    }, delay);
    _timeoutSet.add(timeout);
  }
  function clearAllTimeout() {
    for (const timeout of _timeoutSet.values()) {
      clearTimeout(timeout);
    }
    _timeoutSet.clear();
  }

  onMount(() => {
    shouldShowMicroThumbnail = true;

    const thumbnailListener = ((_, thumbnailHash) => {
      if (thumbnailHash !== hash) {
        return;
      }
      watingThumbnailCreation = false;
      ipc.removeListener("reportItemThumbnailCreation", thumbnailListener);
      shouldShowMicroThumbnail = true;
    }) as IpcEventListeners["reportItemThumbnailCreation"];
    ipc.on("reportItemThumbnailCreation", thumbnailListener);

    const itemDetailListener = ((_, item) => {
      if (item.id !== itemId) {
        return;
      }
      console.dir(item);
      watingItemDetail = false;
      ipc.removeListener("reportItemDetail", itemDetailListener);
    }) as IpcEventListeners["reportItemDetail"];
    ipc.on("reportItemDetail", itemDetailListener);

    return () => {
      clearAllTimeout();
      ipc.removeListener("reportItemThumbnailCreation", thumbnailListener);
      ipc.removeListener("reportItemDetail", itemDetailListener);

      if (watingThumbnailCreation) {
        ipc.invoke("cancelItemThumbnailCreation", hash);
      }
      if (watingItemDetail) {
        ipc.invoke("cancelItemDetail", itemId);
      }
    };
  });
</script>

<container on:click class:selected>
  <pad>
    {#if shouldShowLoading}
      <SkeletonPlaceholder style="width: 100%; height: 100%; z-index: 1; position: absolute;" />
    {/if}
    {#if shouldShowMicroThumbnail && $normalThumbnailOpacity < 1}
      <img
        class="thumbnail"
        on:load={handleMicroThumbnailLoad}
        on:error={handleThumbnailError}
        style="transform: scale({$thumbnailScale * 1.015}); opacity: {$microThumbnailOpacity};"
        alt=""
        src="file://{microThumbnailPath}"
      />
    {/if}
    {#if shouldShowNormalThumbnail}
      <img
        class="thumbnail"
        on:load={handleNormalThumbnailLoad}
        on:error={handleThumbnailError}
        class:definitely-cover={$thumbnailScale === getCoverScale(thumbnailAspectRatio)}
        style="transform: scale({$thumbnailScale}); opacity: {$normalThumbnailOpacity};"
        alt=""
        src="file://{normalThumbnailPath}"
      />
    {/if}
    {#if lost}<span>ERROR IT IS LOST</span>{/if}
    {#if selected}
      <inner-border
        class:thick={selectedItemBorderMode === 'thick'}
        class:thin={selectedItemBorderMode === 'thin'}
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
  }
  pad {
    display: block;
    width: 100%;
    height: 100%;
    position: absolute;
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
