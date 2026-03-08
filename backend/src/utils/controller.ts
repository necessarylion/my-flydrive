import type { Context } from "hono";
import Container from "typedi";

type Constructor<T> = new (...args: any[]) => T;

export function Controller<T>(
  controller: Constructor<T>,
  method: keyof T,
): (c: Context) => Promise<Response> {
  const instance = Container.get(controller);
  return (instance[method] as Function).bind(instance);
}
