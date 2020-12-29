<script lang="ts">
  import {
    Slider,
    TextInput,
    Dropdown,
    Select,
    SelectItem,
    Toggle,
    InlineLoading,
    Button,
    ButtonSet,
    TextArea,
  } from "carbon-components-svelte";
  import type { ButtonProps } from "carbon-components-svelte/types/Button/Button";
  import type { InlineLoadingProps } from "carbon-components-svelte/types/InlineLoading/InlineLoading";
  import { appName } from "../environments";
  import { ipc } from "../ipc";
  import {
    currentGalleryPath,
    galleryTitle,
    galleryDescription,
    appColorTheme,
    appMaxRecentGalleryInfoListLength,
    lastReportedIndexingProgress,
    appRecentGalleryInfoList,
  } from "../stores";

  let indexingButtonKind: ButtonProps["kind"] = "primary";
  let indexingButtonDisabled = true;
  let indexingButtonText = "";
  let indexingButtonClickHandler: svelte.JSX.EventHandler = null;
  let indexingOptionToggleDisabled = true;
  let indexingLoadingStatus: InlineLoadingProps["status"] = "active";
  let indexingLoadingDescription = "";
  let isPreciseIndexingEnabled = false;
  $: {
    const { phase = null, totalCount, leftCount } = $lastReportedIndexingProgress ?? {};
    indexingButtonKind = (<typeof phase[]>["processing", "aborting"]).includes(phase)
      ? "danger"
      : "primary";
    indexingButtonDisabled = (<typeof phase[]>["started", "aborting"]).includes(phase);
    indexingButtonText = indexingButtonKind === "danger" ? "인덱싱 중단" : "인덱싱 시작";
    indexingButtonClickHandler = indexingButtonKind === "danger" ? abortIndexing : startIndexing;
    indexingOptionToggleDisabled = (<typeof phase[]>["started", "processing", "aborting"]).includes(
      phase
    );
    indexingLoadingStatus =
      (<{ [k in typeof phase]: typeof indexingLoadingStatus }>{
        started: "active",
        processing: "active",
        ended: "finished",
        aborting: "active",
        aborted: "error",
      })[phase] ?? "inactive";
    indexingLoadingDescription =
      (<{ [k in typeof phase]: string }>{
        started: "준비 중",
        processing: `${Math.round(100 - (leftCount / totalCount) * 100)}% (${leftCount}개 남음)`,
        ended: "완료",
        aborting: "중단 중",
        aborted: "중단됨",
      })[phase] ?? "";
  }

  $: appRecentGalleryInfoList.updateOne({
    path: $currentGalleryPath,
    title: $galleryTitle,
    description: $galleryDescription,
  });

  function startIndexing() {
    ipc.invoke("startGalleryIndexing", isPreciseIndexingEnabled);
  }
  function abortIndexing() {
    ipc.invoke("abortGalleryIndexing");
  }
</script>

<page-container>
  <h1>설정</h1>
  {#if $currentGalleryPath}
    <h2>{$galleryTitle} 설정</h2>
    <p>현재 열려있는 갤러리에 대한 설정입니다.</p>
    <page-tile>
      <h3>파일 인덱싱</h3>
      <Toggle
        labelText="기존항목 정밀검사"
        labelA="끔"
        labelB="켬"
        disabled={indexingOptionToggleDisabled}
        bind:toggled={isPreciseIndexingEnabled}
      />
      <Button
        kind={indexingButtonKind}
        disabled={indexingButtonDisabled}
        on:click={indexingButtonClickHandler}
      >
        {indexingButtonText}
      </Button>
      <InlineLoading status={indexingLoadingStatus} description={indexingLoadingDescription} />
    </page-tile>
    <page-tile>
      <h3>메타데이터</h3>
      <TextInput labelText="제목" bind:value={$galleryTitle} />
      <TextArea labelText="설명" bind:value={$galleryDescription} />
    </page-tile>
  {/if}
  <h2>애플리케이션 설정</h2>
  <p>{appName} 앱 자체에 대한 설정입니다.</p>
  <page-tile>
    <h3>색상 테마</h3>
    <Dropdown
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
      min={0}
      max={10}
      minLabel="안 함"
      maxLabel="10개"
      bind:value={$appMaxRecentGalleryInfoListLength}
    />
  </page-tile>
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
    margin: 36px 8px 10px;
    font-size: (22rem / 16);
  }
  p {
    margin: 0 12px 16px;
    font-size: (14rem / 16);
    color: $oc-gray-3;
  }
  page-tile {
    display: grid;
    gap: 10px;
    background-color: mix($oc-gray-8, $oc-gray-9);
    margin: 10px 12px;
    padding: 16px 24px 20px;
    h3 {
      margin: 0 -2px 6px;
      font-size: 1.2rem;
      font-weight: 400;
    }
  }
</style>
