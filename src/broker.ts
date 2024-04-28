import { EventInterface, Event } from "./event";

export type EventsInterface = Record<string, [...any] | ((...args: any) => any) | EventInterface>;

type Events<E extends EventsInterface = EventsInterface> = {
    [K in keyof E]: E[K] extends any[]
        ? (...args: E[K]) => void
        : E[K] extends (...args: any) => any
        ? E[K]
        : E[K] extends EventInterface<infer P>
        ? (payload: P) => Event<string & K, E[K]>
        : never;
};
type EventType<E extends EventsInterface = EventsInterface> = string & keyof Events<E>;
type EventListener<E extends EventsInterface, T extends EventType<E>> = Events<E>[T] extends (
    ...args: any
) => any
    ? Events<E>[T]
    : never;
type EventListenerArgs<E extends EventsInterface, T extends EventType<E>> = Parameters<EventListener<E, T>>;

type ListenersOptions<E extends EventsInterface> = {
    /** Use `Event` classes as listener arg */
    eventClasses?: boolean;
};

export type ReadOnlyBroker<E extends EventsInterface = EventsInterface> = Pick<
    Broker<E>,
    "listen" | "addListener" | "removeListener"
>;

export class Broker<E extends EventsInterface = EventsInterface> {
    #listeners = new Map<string, Set<Function>>();
    #anyListeners = new Map<
        Function,
        { filter: ((e: EventType<E>) => boolean) | undefined; listener: Function }
    >();
    #pipe = new Set<Broker<E>>();
    #consume = new Map<Broker<E>, EventListener<E, EventType<E>>>();

    readonly eventClasses: boolean;

    constructor(options?: ListenersOptions<E>) {
        this.eventClasses = !!options?.eventClasses;
    }

    addListener<T extends EventType<E>>(eventType: T, listener: EventListener<E, T>) {
        if (this.#listeners.has(eventType)) this.#listeners.get(eventType)?.add(listener);
        else this.#listeners.set(eventType, new Set([listener]));
        return listener;
    }

    removeListener<T extends EventType<E> = EventType<E>>(
        ...args: [eventType: T, listener: EventListener<E, T>] | [listener: EventListener<E, EventType<E>>]
    ) {
        if (typeof args[0] === "function") {
            this.#anyListeners.delete(args[0]);
        } else {
            this.#listeners.get(args[0])?.delete(args[1]!);
        }
    }

    listen(listener: EventListener<E, EventType<E>>, filter?: (e: EventType<E>) => boolean) {
        this.#anyListeners.set(listener, { listener, filter });
        return listener;
    }

    dispatch<T extends EventType<E>>(eventType: T, ...args: EventListenerArgs<E, T>) {
        let a: any[] = args;

        // transform args to `Event` when `EvxOptions.eventClasses` is set to true
        if (this.eventClasses) {
            a = [new Event(eventType, args[0])];

            if (args.length > 1) {
                args.push(...args.slice(1));
            }
        }

        // notify listeners
        const listeners = this.#listeners.get(eventType);
        listeners?.forEach((listener) => listener(...args));

        // notify any listeners
        this.#anyListeners.forEach((anyListener) => {
            if (anyListener.filter && !anyListener.filter(eventType)) return;
            anyListener.listener(eventType, ...args);
        });

        // pipe
        this.#pipe.forEach((handler) => {
            handler.dispatch(eventType, ...args);
        });
    }

    pipeTo(handler: Broker<E>) {
        this.#pipe.add(handler);
    }

    unpipe(handler: Broker<E>) {
        this.#pipe.delete(handler);
    }

    consume(handler: Broker<E>) {
        const listener = handler.listen(((e: any, ...args: any) => this.dispatch(e, ...args)) as any);
        this.#consume.set(handler, listener);
    }

    endConsume(handler: Broker<E>) {
        this.#consume.delete(handler);
    }

    clear() {
        this.#anyListeners.clear();
        this.#listeners.clear();
        this.#consume.clear();
        this.#pipe.clear();
    }

    readOnly(): ReadOnlyBroker<E> {
        return {
            listen: (listener: any) => {
                return this.listen(listener);
            },
            addListener: (eventType: string, listener: Function) => {
                return this.addListener(eventType as any, listener as any);
            },
            removeListener: (...args: any) => {
                return (this.removeListener as any)(...args);
            },
        };
    }
}
