<script lang="ts">
  import DirectoryPickerModal from "./DirectoryPickerModal.svelte";
  export let open = false;
</script>

<template>
  <DirectoryPickerModal
    bind:open
    heading="기존 갤러리 열기"
    label="기존 갤러리 폴더를 선택하세요."
    pathInputPlaceholder="폴더 위치"
    submitButtonText="갤러리 열기"
    pathValidator={(path, setMessage) => {
      setMessage(path.length > 3 ? 'NICE' : 'bad.');
      return path.length > 3;
    }}
    on:submit
  >
    갤러리 폴더 내에는 색인 폴더인
    <code>.darkgallery</code>
    폴더가 위치해있습니다.
    <em>색인 폴더는 숨김 처리되어 있으므로 파일 탐색기에서 보이지 않을 수 있습니다.</em>
  </DirectoryPickerModal>
</template>
