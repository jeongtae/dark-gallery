<script lang="ts">
  import DirectoryPickerModal from "./DirectoryPickerModal.svelte";
  export let open = false;
</script>

<template>
  <DirectoryPickerModal
    bind:open
    heading="새로 만들기"
    label="갤러리로 만들 폴더를 선택하세요."
    pathInputPlaceholder="폴더 위치"
    submitButtonText="갤러리 생성"
    pathValidator={(path, setMessage) => {
      setMessage(path.length > 3 ? 'NICE' : 'bad.');
      return path.length > 3;
    }}
    on:submit
  >
    해당 위치에 색인 폴더인
    <code>.darkgallery</code>
    폴더가 생성되며, 모든 하위 디렉터리의 사진과 비디오가 색인됩니다.
    <em>색인 폴더를 임의로 삭제하면 해당 갤러리의 모든 정보가 유실됩니다.</em>
  </DirectoryPickerModal>
</template>
