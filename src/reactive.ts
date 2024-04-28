export type Compute<O extends object> = { [K in keyof O]?: (object: O) => O[K] };

export type ReactiveOptions<O extends object> = {
    compute?: Compute<O>;
    initialData?: O;
    onSet?: (key: string | symbol, value: any) => void;
};

export class Reactive<O extends object> {
    /** Computed values error depth */
    static __errorDepth = 1000;
    static from<O extends object>(options: ReactiveOptions<O>) {
        return new Reactive(options);
    }

    #data: any = {};
    #proxy: any;
    #deps: Record<string | symbol, (string | symbol)[]> = {};
    #computers: Compute<O> = {};
    /** Set to observe keys set are set, or set to undefined, to disable observations */
    #observe: Set<string | symbol> | undefined;
    #onSet?: (key: string | symbol, value: any, object: O) => void;

    constructor(options: ReactiveOptions<O> = {}) {
        if (options.compute) this.#computers = options.compute;

        this.#proxy = new Proxy<any>(
            {},
            {
                get: (target, key) => {
                    if (this.#observe) this.#observe.add(key);
                    return this.#data[key];
                },
                set: (target, key, value) => {
                    target[key] = value;
                    this.#setValue(key, value);
                    if (this.#onSet) this.#onSet(key, value, { ...this.#data });
                    return true;
                },
            }
        );

        // initialize data
        if (options.initialData) this.#data = { ...options.initialData };

        // initialize computed values (if not already triggerd by ini)
        if (options.compute) this.#compute(Object.keys(options.compute));
    }

    #setValue(key: string | symbol, value: any, depth = 0) {
        if (depth > Reactive.__errorDepth)
            throw new Error(
                `Too many computations (depth ${Reactive.__errorDepth}). You may have created a circular dependency.`
            );

        this.#data[key] = value;

        // compute deps values
        const deps = this.#deps?.[key];
        if (deps?.length) this.#compute(deps, depth);
    }

    #compute(keys: (string | symbol)[], depth = 0) {
        for (const key of keys) {
            const compute = this.#computers[key as keyof O]!;
            if (!compute) continue;
            // -- observe deps
            this.#observe = new Set();
            this.#deps[key] = Array.from(this.#observe);
            // remove self, to prevent circular dependencies
            this.#observe.delete(key);
            this.#observe = undefined;
            // -- set value
            this.#setValue(key, compute({ ...this.#data }), depth);
        }
    }

    get data(): O {
        return this.#proxy;
    }

    keys() {
        return Object.keys(this.#data);
    }
}
