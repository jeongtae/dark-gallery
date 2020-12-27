<script lang="ts">
  import {
    Slider,
    TextInput,
    Dropdown,
    Select,
    SelectItem,
    TextArea,
  } from "carbon-components-svelte";
  import {
    currentGalleryPath,
    galleryTitle,
    appColorTheme,
    appMaxRecentGalleryInfoListLength,
  } from "../stores";

  let galleryDescription = "동일한 효력을 범죄에 의하여 모든 시설기준과 국내법과 보장하기.";
</script>

<page-container>
  <h1>설정</h1>

  <h2>애플리케이션 설정</h2>
  <p>Dark Gallery 앱 자체에 대한 설정입니다.</p>
  <page-tile>
    <h3>색상 테마</h3>
    <Dropdown
      titleText="색상 테마"
      bind:selectedIndex={$appColorTheme}
      items={['다크', '라이트', '자동 (시스템 설정에 따름)'].map((text, id) => ({
        text,
        id: id.toString(),
      }))}
    />
  </page-tile>
  <page-tile>
    <h3>최근 갤러리 기억</h3>
    <Slider
      labelText="최근 갤러리 기억"
      min={0}
      max={10}
      minLabel="안 함"
      maxLabel="10개"
      bind:value={$appMaxRecentGalleryInfoListLength}
    />
  </page-tile>

  {#if $currentGalleryPath}
    <h2>{$galleryTitle} 설정</h2>
    <p>현재 열려있는 갤러리에 대한 설정입니다.</p>
    <page-tile>
      <h3>제목</h3>
      <TextInput labelText="제목" bind:value={$galleryTitle} />
    </page-tile>
    <page-tile>
      <h3>설명</h3>
      <TextArea labelText="설명" bind:value={galleryDescription} />
    </page-tile>
  {/if}
</page-container>

<style lang="scss">
  @import "open-color/open-color";

  page-container {
    display: block;
    max-width: 1000px;
    margin: 32px auto 24px;
    padding: 0 24px;
  }
  h1 {
    margin: 32px 0 8px;
    font-weight: 500;
    font-size: (30rem / 16);
  }
  h2 {
    margin: 30px 8px 10px;
    font-size: (22rem / 16);
  }
  p {
    margin: 0 12px 16px;
    font-size: (14rem / 16);
    color: $oc-gray-3;
  }
  h3 {
    margin: 0 4px 8px;
    font-size: 1.3rem;
    display: none;
  }
  page-tile {
    display: block;
    background-color: mix($oc-gray-8, $oc-gray-9);
    margin: 10px 12px;
    padding: 16px 24px;
  }
</style>
