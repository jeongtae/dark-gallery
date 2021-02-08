import { delay } from "./utils";

type TaskProcessingCallback<T, TReturn> = (task: T) => TReturn | Promise<TReturn>;

type BackgroundTaskProcessorStatus = "running" | "processing" | "stopped";

export type TaskDoneListener<T, TReturn> = (task: T, result: TReturn) => void;
export type TaskErrorListener<T> = (task: T, error?: Error) => void;
export type TaskCanceledListener<T> = (task: T) => void;

interface TaskListeners<T, TReturn> {
  done: TaskDoneListener<T, TReturn>;
  error: TaskErrorListener<T>;
  canceled: TaskCanceledListener<T>;
}
type TaskListenerSets<T, TReturn> = {
  [K in keyof TaskListeners<T, TReturn>]: Set<TaskListeners<T, TReturn>[K]>;
};

interface BackgroundTaskProcessorOptions {
  taskListProcessingPriority: "fifo" | "lifo";
  taskListCancelingPriority: "fifo" | "lifo";
  taskListMaxSize: number;
  taskProcessingLoopIntervalMs: number;
}

export default class BackgroundTaskProcessor<T, TReturn> implements Disposable {
  private readonly options: Readonly<BackgroundTaskProcessorOptions> = {
    taskListProcessingPriority: "fifo",
    taskListCancelingPriority: "fifo",
    taskListMaxSize: -1,
    taskProcessingLoopIntervalMs: 50,
  };
  public get status(): BackgroundTaskProcessorStatus {
    return this.#status;
  }
  #status: BackgroundTaskProcessorStatus = "stopped";

  private taskList: T[] = [];
  private loopIntervalId: NodeJS.Timeout;
  private shouldBreakLoop = false;

  private listeners: TaskListenerSets<T, TReturn> = {
    done: new Set(),
    error: new Set(),
    canceled: new Set(),
  };

  constructor(
    readonly taskProcessingCallback: TaskProcessingCallback<T, TReturn>,
    options?: BackgroundTaskProcessorOptions
  ) {
    Object.assign(this.options, options ?? {});
  }

  start() {
    this.#status = "running";
    const shouldPopFirstIn = this.options.taskListProcessingPriority === "fifo";
    this.loopIntervalId = setInterval(async () => {
      this.#status = "processing";
      while (this.taskList.length && !this.shouldBreakLoop) {
        const task = this.popTask(shouldPopFirstIn);
        try {
          const taskResult = await this.taskProcessingCallback(task);
          this.notifyListeners("done", task, taskResult);
        } catch (error) {
          this.notifyListeners("error", task, error);
        }
      }
      this.#status = "running";
    }, this.options.taskProcessingLoopIntervalMs);
  }

  async stop() {
    if (this.status === "stopped") {
      return;
    }
    if (this.status === "processing") {
      this.shouldBreakLoop = true;
      while (this.#status === "processing") {
        await delay(100);
      }
      this.shouldBreakLoop = false;
    }
    this.#status = "stopped";
    clearTimeout(this.loopIntervalId);
    this.loopIntervalId = undefined;
  }

  pushTask(task: T) {
    if (this.options.taskListMaxSize > 0 && this.taskList.length >= this.options.taskListMaxSize) {
      const shouldPopFirstIn = this.options.taskListCancelingPriority === "fifo";
      const task = this.popTask(shouldPopFirstIn);
      this.notifyListeners("canceled", task);
    }
    this.taskList.push(task);
  }

  popTask(popFirstIn = false) {
    return popFirstIn ? this.taskList.splice(0, 1)[0] : this.taskList.pop();
  }

  findTask(predicate: Parameters<Array<T>["find"]>[0]) {
    return this.taskList.find(predicate);
  }

  cancelTask(task: T, findFromLast = false) {
    const indexToCancel = findFromLast
      ? this.taskList.lastIndexOf(task)
      : this.taskList.indexOf(task);

    if (indexToCancel >= 0) {
      this.taskList.splice(indexToCancel, 1);
      return true;
    } else {
      return false;
    }
  }

  cancelAllTasks() {
    for (const task of this.taskList) {
      this.notifyListeners("canceled", task);
    }
    this.taskList = [];
  }

  private notifyListeners<E extends keyof TaskListeners<T, TReturn>>(
    event: E,
    ...params: Parameters<TaskListeners<T, TReturn>[E]>
  ) {
    this.listeners[event].forEach((listener: Function) => listener(...params));
  }

  addListener<E extends keyof TaskListeners<T, TReturn>>(
    event: E,
    listener: TaskListeners<T, TReturn>[E]
  ) {
    this.listeners[event].add(<any>listener);
  }

  removeListener<E extends keyof TaskListeners<T, TReturn>>(
    event: E,
    listener: TaskListeners<T, TReturn>[E]
  ) {
    this.listeners[event].delete(<any>listener);
  }

  async dispose() {
    await this.stop();
  }
}
