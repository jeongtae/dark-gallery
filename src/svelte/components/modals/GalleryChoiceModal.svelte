<script lang="ts">
  import ipc from "../../ipc";
  import DirectoryPickerModal from "./DirectoryPickerModal.svelte";
  import type { PathValidator } from "./DirectoryPickerModal.svelte";
  export let open = false;

  const pathValidator: PathValidator = async (path, setMessage) => {
    const pathStatus = await ipc.invoke("getPathStatus", { path });
    if (!pathStatus.isAbsolute) {
      setMessage("절대 경로를 사용해야 합니다.");
      return false;
    }
    if (!pathStatus.exists || !pathStatus.isDirectory) {
      setMessage("존재하지 않는 폴더입니다.");
      return false;
    }
    if (!pathStatus.isGallery) {
      setMessage("갤러리 폴더가 아닙니다.");
      return false;
    }
    if (!pathStatus.directoryHasReadPermission) {
      setMessage("폴더에 접근 권한이 없습니다.");
      return false;
    }
    if (!pathStatus.directoryHasWritePermission) {
      setMessage("폴더에 쓰기 권한이 없습니다.");
      return false;
    }
    if (!pathStatus.directoryHasReadPermission) {
      setMessage("갤러리 색인 폴더에 접근 권한이 없습니다.");
      return false;
    }
    if (!pathStatus.directoryHasWritePermission) {
      setMessage("갤러리 색인 폴더에 쓰기 권한이 없습니다.");
      return false;
    }

    setMessage("이 갤러리를 열 수 있습니다.");
    return true;
  };
</script>

<template>
  <DirectoryPickerModal
    bind:open
    heading="기존 갤러리 열기"
    label="기존 갤러리 폴더를 선택하세요."
    pathInputPlaceholder="폴더 위치"
    submitButtonText="갤러리 열기"
    {pathValidator}
    on:submit
  >
    갤러리 폴더 내에는 색인 폴더인
    <code>.darkgallery</code>
    폴더가 위치해있습니다.
    <em>색인 폴더는 숨김 처리되어 있으므로 파일 탐색기에서 보이지 않을 수 있습니다.</em>
  </DirectoryPickerModal>
</template>
