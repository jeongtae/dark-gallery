<script context="module" lang="ts">
  /** 고정탭 ID 유니언타입 */
  type FixedTabId = "home" | "gallery" | "settings";
</script>

<script lang="ts">
  import oc from "open-color";
  import { onMount } from "svelte";
  import type { SvelteComponent } from "svelte";
  import Home20 from "carbon-icons-svelte/lib/Home20";
  import Grid20 from "carbon-icons-svelte/lib/Grid20";
  import Settings20 from "carbon-icons-svelte/lib/Settings20";
  import HomePage from "./pages/HomePage.svelte";
  import GalleryPage from "./pages/GalleryPage.svelte";
  import SettingsPage from "./pages/SettingsPage.svelte";
  import CustomElectronTitlebar from "./components/CustomElectronTitlebar.svelte";
  import TabBar from "./components/TabBar.svelte";
  import type { Tab, FixedTab, FluidTab } from "./components/TabBar.svelte";
  import ipc from "./ipc";
  import { galleryPathStore, galleryConfigStores } from "./stores";
  import { appName } from "./environments";

  //#region 내부 상태

  /** 고정탭 모음객체*/
  const fixedTabs: { [id in FixedTabId]: FixedTab } = {
    home: { id: "home", title: "홈", icon: Home20 },
    gallery: { id: "gallery", title: "갤러리", icon: Grid20 },
    settings: { id: "settings", title: "설정", icon: Settings20 },
  };

  /** 고정탭 ID 별 페이지 모음객체 */
  const fixedTabPages: { [id in FixedTabId]: typeof SvelteComponent } = {
    home: HomePage,
    gallery: GalleryPage,
    settings: SettingsPage,
  };

  /** 좌측 고정탭 객체 */
  let leftFixedTab: FixedTab = fixedTabs.home;
  /** 우측 고정탭 객체 */
  const rightFixedTab: FixedTab = fixedTabs.settings;
  /** 중앙 유동탭 목록 */
  let centerFluidTabs: FluidTab[];

  /** 선택된 탭 ID (고정탭 또는 유동탭) */
  let selectedTabId = leftFixedTab.id;

  //#endregion

  //#region 스토어
  const { title: galleryTitleStore } = galleryConfigStores;
  //#endregion

  //#region 반응형 구문 및 선언

  $: handleCurrentGalleryChange($galleryPathStore);
  $: updateTitle($galleryTitleStore ?? appName, selectedTab.title);
  $: selectedTab = [leftFixedTab, rightFixedTab, ...centerFluidTabs].find(
    tab => tab.id === selectedTabId
  );
  function handleCurrentGalleryChange(galleryPath: string) {
    const shouldRestore = selectedTabId === leftFixedTab.id;
    leftFixedTab = galleryPath ? fixedTabs.gallery : fixedTabs.home;
    if (shouldRestore) {
      selectedTabId = leftFixedTab.id;
    }
  }
  function updateTitle(main: string, sub: string) {
    if (sub) {
      document.title = `${sub} \u2500 ${main}`;
    } else {
      document.title = main;
    }
  }

  //#endregion

  // 디버그용 유동탭 할당
  centerFluidTabs = [
    { id: "apl", title: "Apple", thumbnail: "apple.jpg" },
    { id: "ban", title: "Banana", thumbnail: "banana.jpg" },
    { id: "grp", title: "Grape", thumbnail: "grape.jpg" },
    { id: "org", title: "Orange", thumbnail: "orange.jpg" },
    { id: "wtm", title: "Watermelon", thumbnail: "watermelon.jpg" },
    { id: "lmn", title: "Lemon", thumbnail: "lemon.jpg" },
    { id: "kwi", title: "Kiwi", thumbnail: "kiwi.jpg" },
    { id: "pch", title: "Peach", thumbnail: "peach.jpg" },
    { id: "per", title: "Pear", thumbnail: "pear.jpg" },
  ];

  onMount(() => {
    ipc.on("clickMenu", (event, id) => {
      if (id === "openPreference") {
        selectedTabId = fixedTabs.settings.id;
      }
    });
    ipc.on("openGallery", (event, { path, title }) => {
      $galleryPathStore = path;
    });
  });
</script>

<svelte:head>
  <title>{appName}</title>
</svelte:head>
<CustomElectronTitlebar color={oc.gray[9]} />
<app-container>
  <TabBar {leftFixedTab} {rightFixedTab} bind:centerFluidTabs bind:selectedTabId />
  <app-page-switcher>
    <app-page-wrapper class:hidden={selectedTab !== leftFixedTab}>
      <svelte:component this={fixedTabPages[leftFixedTab.id]} />
    </app-page-wrapper>
    <app-page-wrapper class:hidden={selectedTab !== rightFixedTab}>
      <svelte:component this={fixedTabPages[rightFixedTab.id]} />
    </app-page-wrapper>
  </app-page-switcher>
</app-container>

<style lang="scss">
  @import "open-color/open-color";
  @import "./global";

  app-container {
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  app-page-switcher {
    display: block;
    flex: 1;
    position: relative;

    app-page-wrapper {
      position: absolute;
      top: 0;
      right: 0;
      bottom: 0;
      left: 0;
      overflow-x: hidden;
      overflow-y: auto;
      &.hidden {
        visibility: hidden;
      }
      &:focus {
        outline: none;
      }
      &::-webkit-scrollbar {
        width: 6px;
        background-color: transparent;
      }
      &::-webkit-scrollbar-thumb {
        background-color: $oc-gray-7;
      }
    }
  }
</style>
