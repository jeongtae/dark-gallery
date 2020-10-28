<script lang="ts">
  const { ipcRenderer } = require("electron");

  import { onMount, createEventDispatcher } from "svelte";
  import { debounce } from "lodash";
  import { Modal, TextInput, Button, InlineLoading } from "carbon-components-svelte";
  import Folder16 from "carbon-icons-svelte/lib/Folder16";

  const dispatch = createEventDispatcher();

  let pathInputElement: HTMLInputElement;
  let findButtonElement: HTMLButtonElement;
  let status: "init" | "empty" | "typing" | "invalid" | "valid";
  const statusMap: {
    readonly [key in typeof status]: "active" | "inactive" | "finished" | "error";
  } = {
    init: "inactive",
    empty: "error",
    typing: "active",
    invalid: "error",
    valid: "finished",
  };
  let statusMessage: string;
  const statusMessageMap: { [key in typeof status]?: string } = {
    empty: "경로를 입력하세요",
    typing: "검사 중",
  };
  function setMessage(message: string) {
    statusMessage = message;
  }

  /** 모달의 열림 상태 */
  export let open: boolean = false;

  /** 모달의 제목 */
  export let heading: string = "디렉터리 선택";

  /** 모달 제목 아래의 설명 레이블 */
  export let label: string = "디렉터리를 선택하세요.";

  /** 패스 입력란의 플레이스홀더 */
  export let pathInputPlaceholder: string = "디렉터리 위치";

  /** 확인 버튼의 텍스트 */
  export let submitButtonText: string = "확인";

  /** 패스의 유효성 검사 콜백 */
  type MessageSetter = typeof setMessage;
  export let pathValidator: (path: string, setMessage: MessageSetter) => boolean;

  let validatingPath = false;
  const _validatePathImmediately = (path: string) => {
    if (validatingPath) {
      const isValid = pathValidator ? pathValidator(path, setMessage) : true;
      status = isValid ? "valid" : "invalid";
    }
  };
  const _validatePathDebounced = debounce(_validatePathImmediately, 1000);
  function validatePath() {
    const path = pathInputElement.value;
    status = "typing";
    if (path.length) {
      validatingPath = true;
      _validatePathDebounced(path);
    } else {
      validatingPath = false;
      status = "empty";
    }
  }

  function handleOpen() {
    pathInputElement.value = "";
    validatingPath = false;
    status = "init";
  }
  function handleCancel() {
    open = false;
  }
  function handleSubmit() {
    open = false;
    dispatch("submit", pathInputElement.value);
  }

  onMount(() => {
    const handleIpc = (e, path) => {
      if (open && path) {
        pathInputElement.value = path;
        validatePath();
        findButtonElement.focus();
        // validatingPath = true;
        // _validatePathImmediately(path);
      }
    };
    ipcRenderer.addListener("util-pick-dir", handleIpc);
    return () => {
      ipcRenderer.removeListener("util-pick-dir", handleIpc);
    };
  });
</script>

<template>
  <Modal
    bind:open
    size="sm"
    primaryButtonText={submitButtonText}
    secondaryButtonText="취소"
    primaryButtonDisabled={status !== 'valid'}
    on:open={handleOpen}
    on:click:button--secondary={handleCancel}
    on:submit={handleSubmit}
    selectorPrimaryFocus="input#path"
    iconDescription="닫기"
  >
    <div slot="heading">{heading}</div>
    <p class="label">{label}</p>
    <div class="row">
      <TextInput
        size="sm"
        placeholder={pathInputPlaceholder}
        bind:ref={pathInputElement}
        on:input={validatePath}
        invalid={status === 'empty' || status === 'invalid'}
        id="path"
      />
      <Button
        size="small"
        icon={Folder16}
        kind="secondary"
        on:click={() => {
          ipcRenderer.send('util-pick-dir', { title: label, buttonLabel: '선택' });
        }}
        bind:ref={findButtonElement}
      >
        찾아보기
      </Button>
    </div>
    <p class="status" style={status === 'init' && 'visibility: hidden'}>
      <InlineLoading
        description={statusMessageMap[status] ?? statusMessage}
        status={statusMap[status]}
      />
    </p>
    <p class="slot">
      <slot />
    </p>
  </Modal>
</template>

<style lang="scss">
  @import "open-color/open-color";

  .label {
    margin: 0 4px 16px;
  }

  .row {
    display: flex;
    align-items: flex-start;
    height: 2rem;
    overflow-y: hidden;
    > :global(*:first-child) {
      flex: 1;
    }
  }

  .slot {
    margin: 0 4px 0;
    font-size: 0.875rem;
    color: $oc-gray-5;
    :global(code) {
      border-radius: 3px;
      background-color: $oc-gray-7;
      padding: 1px 3px;
      margin: 0 2px;
    }
    :global(em) {
      display: block;
      margin-top: 6px;
      color: $oc-red-4;
      font-style: normal;
      :global(strong) {
        color: $oc-red-5;
      }
    }
  }
</style>
