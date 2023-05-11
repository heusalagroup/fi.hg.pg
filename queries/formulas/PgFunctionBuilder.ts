// Copyright (c) 2023. Heusala Group Oy <info@heusalagroup.fi>. All rights reserved.

import { QueryBuilder } from "../../../core/data/persisters/types/QueryBuilder";

/**
 * This generates formulas like `f(formula)`
 */
export class PgFunctionBuilder implements QueryBuilder {

    /**
     * The function name
     * @private
     */
    protected readonly _name : string;
    protected _builder : QueryBuilder | undefined;

    public constructor (name : string) {
        this._name = name;
        this._builder = undefined;
    }

    public setFormulaFromQueryBuilder (builder : QueryBuilder) {
        this._builder = builder;
    }

    public build (): [ string, any[] ] {
        return [ this.buildQueryString(), this.buildQueryValues() ];
    }

    public buildQueryString (): string {
        if (!this._builder) throw new TypeError(`Could not build ${this._name}() query string: Query builder not initialized`);
        return `${this._name}(${this._builder.buildQueryString()})`;
    }

    public buildQueryValues (): any[] {
        if (!this._builder) throw new TypeError(`Could not build ${this._name}() query values: Query builder not initialized`);
        return this._builder.buildQueryValues();
    }

    public getQueryValueFactories (): (() => any)[] {
        if (!this._builder) throw new TypeError(`Could not build ${this._name}() query factories: Query builder not initialized`);
        return this._builder.getQueryValueFactories();
    }

    public static create (builder: QueryBuilder, name: string) : PgFunctionBuilder {
        const f = new PgFunctionBuilder(name);
        f.setFormulaFromQueryBuilder(builder);
        return f;
    }

}
