<script lang="ts">
  import ipc from "../../ipc";
  import DirectoryPickerModal from "./base/DirectoryPickerModal.svelte";
  import type { PathValidator } from "./base/DirectoryPickerModal.svelte";
  export let open = false;

  const pathValidator: PathValidator = async (path, setMessage) => {
    const pathStatus = await ipc.invoke("checkGalleryPath", { path });
    if (!pathStatus.isAbsolute) {
      setMessage("절대 경로를 사용해야 합니다.");
      return false;
    }
    if (!pathStatus.exists || pathStatus.isDirectory === false) {
      setMessage("존재하지 않는 폴더입니다.");
      return false;
    }
    if (pathStatus.directoryHasReadPermission === false) {
      setMessage("폴더에 접근 권한이 없습니다.");
      return false;
    }
    if (pathStatus.directoryHasWritePermission === false) {
      setMessage("폴더에 쓰기 권한이 없습니다.");
      return false;
    }
    if (pathStatus.isDecendantDirectoryOfGallery) {
      setMessage("다른 갤러리의 하위 폴더입니다.");
      return false;
    }
    if (pathStatus.isGallery) {
      setMessage("이미 갤러리 폴더입니다.");
      return false;
    }

    setMessage("여기에 새로운 갤러리를 생성할 수 있습니다.");
    return true;
  };
</script>

<template>
  <DirectoryPickerModal
    bind:open
    heading="새로 만들기"
    label="갤러리로 만들 폴더를 선택하세요."
    pathInputPlaceholder="폴더 위치"
    submitButtonText="갤러리 생성"
    {pathValidator}
    on:submit
  >
    해당 위치에 색인 폴더인
    <code>.darkgallery</code>
    폴더가 생성되며, 모든 하위 폴더의 사진과 비디오가 색인됩니다.
    <em>색인 폴더를 임의로 삭제하면 해당 갤러리의 모든 정보가 유실됩니다.</em>
  </DirectoryPickerModal>
</template>
