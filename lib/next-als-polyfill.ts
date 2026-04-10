import { AsyncLocalStorage } from "node:async_hooks";

const g = globalThis as typeof globalThis & {
  AsyncLocalStorage?: typeof AsyncLocalStorage;
};

if (g.AsyncLocalStorage === undefined) {
  g.AsyncLocalStorage = AsyncLocalStorage;
}
