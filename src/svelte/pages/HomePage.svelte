<script lang="ts">
  import type * as Ipc from "../../ipc";
  import { Button, Loading, OverflowMenu, OverflowMenuItem } from "carbon-components-svelte";
  import Add16 from "carbon-icons-svelte/lib/Add16";
  import Folder16 from "carbon-icons-svelte/lib/Folder16";
  import Close16 from "carbon-icons-svelte/lib/Close16";
  import Debug16 from "carbon-icons-svelte/lib/Debug16";
  import {
    recentGalleryInfoListStore,
    pushRecentGalleryInfo,
    currentGalleryInfoStore,
    environments,
  } from "../stores";
  import GalleryCreationModal from "../components/modals/GalleryCreationModal.svelte";
  import GalleryChoiceModal from "../components/modals/GalleryChoiceModal.svelte";

  const { ipcRenderer } = require("electron");
  const ipc = ipcRenderer as Ipc.TypedIpcRenderer;

  let creationModalIsOpen = false;
  let choiceModalIsOpen = false;
  let isLoading = false;

  /** 디렉터리를 갤러리로 만든다.
   * @param path 갤러리로 만들 절대경로
   * @returns 성공 여부 */
  async function makeGallery(path: string) {
    return await ipc.invoke("makeGallery", { path });
  }

  /** 로딩 모달을 표시하고, 갤러리를 여는 IPC를 요청한다.
   * 성공 시, 현재 갤러리 스토어를 수정하고 최근 갤러리 목록 스토어에 푸시한다.
   * @param path 갤러리의 절대경로, 미지정시 개발용 갤러리를 연다.
   * @returns 성공 여부 */
  async function openGallery(path?: string) {
    const title = !path
      ? await ipc.invoke("openDevGallery")
      : await ipc.invoke("openGallery", { path });
    if (title) {
      $currentGalleryInfoStore = { path, title };
      if (path) {
        pushRecentGalleryInfo({ path, title });
      }
    }
    return !!title;
  }

  async function handleCreationSubmit({ detail: path }) {
    try {
      isLoading = true;

      const created = await makeGallery(path);
      if (!created) throw new Error("");

      const opened = await openGallery(path);
      if (!opened) throw new Error("");
    } catch {
      // TODO: push error toast
    } finally {
      isLoading = false;
    }
  }
  async function handleChoiceSubmit({ detail: path }) {
    try {
      isLoading = true;
      const opened = await openGallery(path);
      if (!opened) throw new Error("");
    } catch {
      // TODO: push error toast
    } finally {
      isLoading = false;
    }
  }
  const handleClickRecentGallery: svelte.JSX.EventHandler = async e => {
    const path = e.currentTarget.dataset.path as string;
    try {
      isLoading = true;
      const opened = await openGallery(path);
      if (!opened) throw new Error("");
    } catch {
      // TODO: push error toast
    } finally {
      isLoading = false;
    }
  };
  async function handleClickOpenDevGallery() {
    try {
      isLoading = true;
      const opened = await openGallery();
      if (!opened) throw new Error("");
    } catch {
      // TODO: push error toast
    } finally {
      isLoading = false;
    }
  }
  async function handleClickResetDevGallery() {
    try {
      isLoading = true;
      const reset = await ipc.invoke("resetDevGallery");
      if (!reset) throw new Error("");
    } catch {
      // TODO: push error toast
    } finally {
      isLoading = false;
    }
  }
</script>

<template>
  <div class="container">
    <h1>{environments.appName}</h1>
    <p>{environments.appDescription}</p>
    <h2>시작하기</h2>
    <p>새 갤러리를 만들거나 기존 갤러리를 여세요.</p>
    <div class="gallery-buttons-wrapper">
      <Button
        size="small"
        icon={Add16}
        kind="primary"
        on:click={() => (creationModalIsOpen = true)}
      >
        새로 만들기
      </Button>
      <Button
        size="small"
        icon={Folder16}
        kind="secondary"
        on:click={() => (choiceModalIsOpen = true)}
      >
        기존 갤러리 열기
      </Button>
      {#if environments.isDev}
        <OverflowMenu icon={Debug16}>
          <OverflowMenuItem
            text="개발용 갤러리 열기"
            primaryFocus
            on:click={handleClickOpenDevGallery}
          />
          <OverflowMenuItem
            text="개발용 갤러리 초기화"
            danger
            on:click={handleClickResetDevGallery}
          />
        </OverflowMenu>
      {/if}
    </div>
    {#if $recentGalleryInfoListStore.length}
      <h2>최근 갤러리</h2>
      <div class="recent-buttons-wrapper">
        {#each $recentGalleryInfoListStore as info, idx (info.path)}
          <div class="row">
            <div class="primary-button-wrapper">
              <Button
                size="small"
                kind="ghost"
                on:click={handleClickRecentGallery}
                data-path={info.path}
              >
                {info.title}
              </Button>
            </div>
            <span class="path">{info.path}</span>
            <div class="delete-button-wrapper">
              <Button
                size="small"
                icon={Close16}
                on:click={() => {
                  recentGalleryInfoListStore.update(list => {
                    list.splice(idx, 1);
                    return list;
                  });
                }}
                hasIconOnly
                iconDescription="목록에서 제거"
                tooltipPosition="right"
                tooltipAlignment="center"
              />
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
  <GalleryCreationModal bind:open={creationModalIsOpen} on:submit={handleCreationSubmit} />
  <GalleryChoiceModal bind:open={choiceModalIsOpen} on:submit={handleChoiceSubmit} />
  <Loading active={isLoading} />
</template>

<style lang="scss">
  @import "open-color/open-color";

  .container {
    max-width: 1000px;
    margin: 32px auto 24px;
    padding: 0 24px;
  }
  h1 {
    margin: 32px 0 8px;
    font-weight: 500;
  }
  h2 {
    margin: 28px 0 12px;
  }
  p {
    margin: 0 8px;
  }
  .gallery-buttons-wrapper > :global(button) {
    margin: 12px 12px;
    display: inline-flex;
    &:first-child {
      margin-right: 4px;
    }
    &:last-child {
      margin-left: 4px;
    }
  }
  .recent-buttons-wrapper {
    .row {
      margin: 1px 4px;
      display: flex;
      width: fit-content;
      align-items: center;
      .primary-button-wrapper :global(button) {
        margin: 0;
        font-size: 1rem;
      }
      .path {
        margin-right: 12px;
        color: $oc-gray-5;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
        direction: rtl;
        max-width: 300px;
      }
      .delete-button-wrapper :global(button) {
        visibility: hidden;
        background-color: transparent;
        color: $oc-gray-4;
        margin: 0;
        padding: 2px 4px;
        &:hover {
          color: $oc-red-7;
        }
      }
      &:hover .delete-button-wrapper :global(button) {
        visibility: visible;
      }
    }
  }
</style>
