import { BrowserWindow, Menu, MenuItem, MenuItemConstructorOptions } from "electron";
import { MenuItemId } from "../common/ipc";
import { appName, isMac, isDev } from "./environments";

type MenuClickHandler = (id: MenuItemId, window: BrowserWindow) => void | Promise<void>;

interface TypedMenuItemConstructorOptions extends MenuItemConstructorOptions {
  id?: MenuItemId;
  submenu?: TypedMenuItemConstructorOptions[] | Menu;
}

let menu: Menu;
let menuClickHandlers: MenuClickHandler[] = [];

export function addMenuClickHandler(handler: MenuClickHandler) {
  menuClickHandlers.push(handler);
}

export function removeMenuClickHandler(handler: MenuClickHandler) {
  const i = menuClickHandlers.indexOf(handler);
  if (i >= 0) {
    menuClickHandlers.splice(i, 1);
  }
}

export function setMenuItemEnabled(id: MenuItemId, enabled: boolean) {
  const menuItem = menu?.getMenuItemById(id);
  if (menuItem) {
    menuItem.enabled = enabled;
  }
}

export function getMenu() {
  const click = (menuItem: MenuItem, window: BrowserWindow) => {
    menuClickHandlers.forEach(handler => handler(menuItem.id as MenuItemId, window));
  };
  return (
    menu ||
    (menu = Menu.buildFromTemplate([
      ...(isMac
        ? [
            {
              label: appName,
              submenu: [
                { label: `${appName} 정보`, role: "about" },
                {
                  label: "환경설정...",
                  accelerator: "Command+,",
                  id: "openPreference",
                  click,
                },
                { type: "separator" },
                { label: "서비스", role: "services" },
                { type: "separator" },
                { label: `${appName} 숨기기`, role: "hide" },
                { label: "기타 숨기기", role: "hideothers" },
                { label: "모두 보기", role: "unhide" },
                { type: "separator" },
                { label: `${appName} 종료`, role: "quit" },
              ],
            } as TypedMenuItemConstructorOptions,
          ]
        : []),
      {
        label: "갤러리",
        submenu: [
          {
            label: "새 창",
            accelerator: "Command+Shift+N",
            id: "newWindow",
            click,
          },
          { type: "separator" },
          { label: "창 닫기", accelerator: "Command+Shift+W", role: "close" },
          { label: "탭 닫기", accelerator: "Command+W", enabled: false },
          ...((isMac ? [] : [{ role: "separator" }, { label: "종료", role: "quit" }]) as Array<
            TypedMenuItemConstructorOptions
          >),
        ],
      } as TypedMenuItemConstructorOptions,
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
              ]) as Array<TypedMenuItemConstructorOptions>),
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
            : []) as Array<TypedMenuItemConstructorOptions>),

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
        : []) as Array<TypedMenuItemConstructorOptions>),
      {
        label: "도움말",
        role: "help",
        submenu: [
          {
            label: "웹 도움말",
            id: "help",
            click,
          },
        ],
      } as TypedMenuItemConstructorOptions,
    ]))
  );
}
