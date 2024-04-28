export type EventInterface<P = any, C = any> = {
    payload?: P;
    contribute?: C;
};

type EventPayload<E extends EventInterface> = E extends EventInterface<infer P>
    ? Exclude<P, undefined>
    : never;

type EventContribution<E extends EventInterface> = E extends EventInterface<any, infer C>
    ? Exclude<C, undefined>
    : never;

export class Event<T extends string = string, E extends EventInterface = EventInterface> {
    constructor(readonly type: T, readonly payload: EventPayload<E> | undefined = undefined) {}

    #defaultPrevented = false;

    preventDefault() {
        this.#defaultPrevented = true;
    }

    get defaultPrevented() {
        return this.#defaultPrevented;
    }

    #contributions: { data: EventContribution<E>; contributor: string }[] = [];

    contribute(data: EventContribution<E>, contributor: string = "") {
        this.#contributions.push({ data, contributor });
    }

    getContributions() {
        return this.#contributions.map((c) => ({ ...c }));
    }
}
