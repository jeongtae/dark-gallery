<script context="module" lang="ts">
  export type PathValidator = (
    path: string,
    setMessage: (message: string) => void
  ) => Promise<boolean> | boolean; //;
</script>

<script lang="ts">
  import { createEventDispatcher, tick } from "svelte";
  import { debounce } from "lodash";
  import { Modal, TextInput, Button, InlineLoading, Icon } from "carbon-components-svelte";
  import Folder16 from "carbon-icons-svelte/lib/Folder16";
  import ipc from "../../../ipc";

  const dispatch = createEventDispatcher();

  let pathInputElement: HTMLInputElement;
  let findButtonElement: HTMLButtonElement;
  let findButtonDisabled: boolean = false;
  let status: "init" | "empty" | "validating" | "invalid" | "valid";
  const statusMap: {
    readonly [key in typeof status]: "active" | "inactive" | "finished" | "error";
  } = {
    init: "inactive",
    empty: "error",
    validating: "active",
    invalid: "error",
    valid: "finished",
  };
  let statusMessage: string;
  const statusMessageMap: { [key in typeof status]?: string } = {
    empty: "경로를 입력하세요",
    validating: "검사 중",
  };
  function setMessage(message: string) {
    statusMessage = message;
  }

  /** 모달의 열림 상태 */
  export let open: boolean = false;

  /** 모달의 제목 */
  export let heading: string = "디렉터리 선택";

  /** 모달의 제목 아이콘 */
  export let icon: typeof Folder16 = null;

  /** 모달 제목 아래의 설명 레이블 */
  export let label: string = "디렉터리를 선택하세요.";

  /** 패스 입력란의 플레이스홀더 */
  export let pathInputPlaceholder: string = "디렉터리 위치";

  /** 확인 버튼의 텍스트 */
  export let submitButtonText: string = "확인";

  /** 패스의 유효성 검사 콜백 */
  export let pathValidator: PathValidator;

  const _validatePathInputDebounced = debounce(async (path: string) => {
    if (status === "validating") {
      const isValid = pathValidator ? await pathValidator(path, setMessage) : true;
      status = isValid ? "valid" : "invalid";
    }
  }, 1000);
  function validatePathInput() {
    const path = pathInputElement.value;
    status = "validating";
    if (path.length) {
      _validatePathInputDebounced(path);
    } else {
      status = "empty";
    }
  }

  function handleOpen() {
    pathInputElement.value = "";
    status = "init";
  }
  async function handleFindButtonClick() {
    findButtonDisabled = true;
    const path = await ipc.invoke("pickDirectory", {
      title: label,
      buttonLabel: "선택",
    });
    if (open && path) {
      pathInputElement.value = path;
      validatePathInput();
    }
    findButtonDisabled = false;
    await tick();
    findButtonElement.focus();
  }
  function handleCancel() {
    open = false;
  }
  function handleSubmit() {
    open = false;
    dispatch("submit", pathInputElement.value);
  }
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
    <div slot="heading" class="heading">
      {#if icon}
        <Icon render={icon} />
      {/if}
      <span>{heading}</span>
    </div>
    <p class="label">{label}</p>
    <div class="row">
      <TextInput
        size="sm"
        placeholder={pathInputPlaceholder}
        bind:ref={pathInputElement}
        on:input={validatePathInput}
        invalid={status === 'empty' || status === 'invalid'}
        id="path"
      />
      <Button
        size="small"
        icon={Folder16}
        kind="secondary"
        on:click={handleFindButtonClick}
        bind:ref={findButtonElement}
        disabled={findButtonDisabled}
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

  .heading {
    display: flex;
    align-items: center;
    span:not(:first-child) {
      margin-left: (6rem / 16);
    }
  }

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
