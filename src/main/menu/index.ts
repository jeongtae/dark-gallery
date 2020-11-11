import { app, Menu, MenuItemConstructorOptions, shell } from "electron";
import { isDev, isMac } from "../environment";

type EventListeners = {
  "click-new-window": () => any;
  "click-preference": () => any;
};

const eventListeners: {
  [K in keyof EventListeners]?: EventListeners[K][];
} = {};

function emitEvent<K extends keyof EventListeners>(
  event: K,
  ...args: Parameters<EventListeners[K]>
) {
  const listeners = (eventListeners[event] ?? []) as EventListeners[K][];
  listeners.forEach(listener => (listener as any)(...args));
}

export const menu = Menu.buildFromTemplate([
  ...(isMac
    ? [
        {
          label: app.name,
          submenu: [
            { label: `${app.name} 정보`, role: "about" },
            {
              label: "환경설정...",
              accelerator: "Command+,",
              click: () => emitEvent("click-preference"),
            },
            { type: "separator" },
            { label: "서비스", role: "services" },
            { type: "separator" },
            { label: `${app.name} 숨기기`, role: "hide" },
            { label: "기타 숨기기", role: "hideothers" },
            { label: "모두 보기", role: "unhide" },
            { type: "separator" },
            { label: `${app.name} 종료`, role: "quit" },
          ],
        } as MenuItemConstructorOptions,
      ]
    : []),
  {
    label: "갤러리",
    submenu: [
      {
        label: "새 창",
        accelerator: "Command+Shift+N",
        click: () => emitEvent("click-new-window"),
      },
      { type: "separator" },
      { label: "창 닫기", accelerator: "Command+Shift+W", role: "close" },
      { label: "탭 닫기", accelerator: "Command+W", enabled: false },
      ...((isMac ? [] : [{ role: "separator" }, { label: "종료", role: "quit" }]) as Array<
        MenuItemConstructorOptions
      >),
    ],
  },
  {
    label: "편집",
    submenu: [
      { label: "입력 실행 취소", role: "undo" },
      { label: "실행 복귀", role: "undo" },
      { type: "separator" },
      { label: "잘라내기", role: "cut" },
      { label: "복사하기", role: "copy" },
      { label: "붙여넣기", role: "paste" },
      ...((isMac
        ? [
            { label: "붙여넣고 스타일 일치시킴", role: "pasteAndMatchStyle" },
            { label: "삭제", role: "delete" },
            { label: "전체 선택", role: "selectAll" },
            { type: "separator" },
            {
              label: "말하기",
              submenu: [
                { label: "말하기 시작", role: "startspeaking" },
                { label: "말하기 중지", role: "stopspeaking" },
              ],
            },
          ]
        : [
            { label: "삭제", role: "delete" },
            { type: "separator" },
            { label: "모두 선택", role: "selectAll" },
          ]) as Array<MenuItemConstructorOptions>),
    ],
  },
  {
    label: "보기",
    submenu: [
      ...((isDev
        ? [
            { role: "reload" },
            { role: "forceReload" },
            { role: "toggleDevTools" },
            { type: "separator" },
          ]
        : []) as Array<MenuItemConstructorOptions>),

      { label: "원본 크기", role: "resetZoom" },
      { label: "확대", role: "zoomIn" },
      { label: "축소", role: "zoomOut" },
      { type: "separator" },
      { label: "전체 화면 시작/종료", role: "togglefullscreen" },
    ],
  },
  ...((isMac
    ? [
        {
          label: "윈도우",
          role: "windowMenu",
          submenu: [
            { label: "최소화", role: "minimize" },
            { label: "확대/축소", role: "zoom" },
            { type: "separator" },
            { label: "모두 앞으로 가져오기", role: "front" },
          ],
        },
      ]
    : []) as Array<MenuItemConstructorOptions>),
  {
    label: "도움말",
    role: "help",
    submenu: [
      {
        label: "웹 도움말",
        click: async () => {
          await shell.openExternal("https://blog.jeongtae.com");
        },
      },
    ],
  },
]);

export function addEventListener<K extends keyof EventListeners>(
  event: K,
  listener: EventListeners[K]
) {
  if (eventListeners[event] === undefined) {
    eventListeners[event] = [];
  }
  const listners = eventListeners[event] as EventListeners[K][];
  listners.push(listener);
}

// export function removeEventListener<K extends keyof EventListeners>(
//   event: K,
//   listener: EventListeners[K][0]
// ) {
//   if (eventListeners[event] === undefined) {
//     return;
//   }
//   // codes here
// }

export class AppMenu {
  readonly menu: Menu;
  private eventListeners: Partial<EventListeners> = {};

  constructor() {}

  public on<K extends keyof EventListeners>(event: K, listener: EventListeners[K]) {
    this.eventListeners[event] = listener;
  }
}
