<script lang="ts">
  import { Button } from "carbon-components-svelte";
  import Add16 from "carbon-icons-svelte/lib/Add16";
  import Folder16 from "carbon-icons-svelte/lib/Folder16";
  import Close16 from "carbon-icons-svelte/lib/Close16";
  import { productName, description } from "../../../package.json";
  import GalleryCreationModal from "../components/modals/GalleryCreationModal.svelte";
  import GalleryChoiceModal from "../components/modals/GalleryChoiceModal.svelte";

  let creationModalIsOpen = false;
  let choiceModalIsOpen = false;
</script>

<template>
  <div class="container">
    <h1>{productName}</h1>
    <p>{description}</p>
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
    </div>
    <h2>최근 갤러리</h2>
    <div class="recent-buttons-wrapper">
      {#each ['Ladarius Huel', 'Skylar Schmeler', 'Justice Hauck', 'Doris Treutel', 'Imani Greenholt'] as name}
        <div class="row">
          <div class="primary-button-wrapper">
            <Button size="small" kind="ghost">{name}</Button>
          </div>
          <span>~/Documents/{name.split(' ')[0]}</span>
          <div class="delete-button-wrapper">
            <Button
              size="small"
              icon={Close16}
              hasIconOnly
              iconDescription="목록에서 제거"
              tooltipPosition="right"
              tooltipAlignment="center"
            />
          </div>
        </div>
      {/each}
    </div>
  </div>
  <GalleryCreationModal bind:open={creationModalIsOpen} on:submit={console.log} />
  <GalleryChoiceModal bind:open={choiceModalIsOpen} on:submit={console.log} />
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
  .gallery-buttons-wrapper :global(button) {
    margin: 12px 12px;
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
      span {
        margin-right: 12px;
        color: $oc-gray-5;
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
