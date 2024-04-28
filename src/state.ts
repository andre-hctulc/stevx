import { Broker } from "./broker";
import { Compute, Reactive } from "./reactive";

export type StateStorage = {
    get: (key: string) => any;
    set: (key: string, state: object) => void;
};

export type StateInit<S extends object> = {
    initialState: S;
    store?: { storage: StateStorage; key: string };
    compute?: Compute<S>;
};

export class State<S extends object = {}> {
    #state: Reactive<S>;
    #store: { storage: StateStorage; key: string } | undefined;
    #broker = new Broker<{ state_change: [key: string, newValue: any, newState: S] }>();

    constructor(init: StateInit<S>) {
        this.#store = init.store;
        this.#state = this.#storeGet() || init.initialState;
        this.#state = new Reactive({
            compute: init.compute,
            initialData: init.initialState,
        });
    }

    get broker() {
        return this.#broker.readOnly();
    }

    #storeGet(): any {
        if (this.#store) return this.#store.storage.get(this.#store.key);
    }

    #storeSet(state: object) {
        if (this.#store) return this.#store.storage.set(this.#store.key, state);
    }

    get<K extends (string & keyof S) | undefined>(key?: K): K extends keyof S ? S[K] : S {
        if (key === undefined) return this.#state.data as any;
        else return this.#state.data[key] as any;
    }

    set<K extends string & keyof S>(key: K, value: S[K] | ((state: S[K]) => void)) {
        if (typeof value === "function") this.#state.data[key] = (value as any)(this.#state);
        else this.#state.data[key] = value;
        if (this.#store) this.#storeSet(this.#state);
        this.#broker.dispatch("state_change", key, this.#state.data[key], { ...this.#state.data });
    }
}
