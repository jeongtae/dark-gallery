import type { CommandHandlers } from "../../ipc";

import pickDirectory from "./pickDirectory";
import getPathStatus from "./getPathStatus";

export const commandHandlers: CommandHandlers = {
  pickDirectory,
  getPathStatus,
};
