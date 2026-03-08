import type { Context } from 'hono';
import Container from 'typedi';

/**
 * A generic constructor type used to represent injectable controller classes.
 * @typeParam T - The class type that the constructor produces.
 */
type Constructor<T> = new (...args: any[]) => T;

/**
 * Creates a Hono-compatible route handler by resolving a controller instance
 * from the typedi container and binding the specified method to it.
 *
 * @typeParam T - The controller class type.
 * @param controller - The controller class to resolve from the DI container.
 * @param method - The name of the method on the controller to invoke.
 * @returns A bound function that accepts a Hono {@link Context} and returns a Promise<Response>.
 */
export function Controller<T>(
  controller: Constructor<T>,
  method: keyof T,
): (c: Context) => Promise<Response> {
  const instance = Container.get(controller);
  return (instance[method] as (...args: unknown[]) => Promise<Response>).bind(instance);
}
