// Copyright (c) 2023. Heusala Group Oy <info@heusalagroup.fi>. All rights reserved.

import { QueryBuilder } from "../../../core/data/persisters/types/QueryBuilder";

/**
 * This generates formulas like `formula->index` which return json array value by
 * index number.
 */
export class PgJsonIndexBuilder implements QueryBuilder {

    protected readonly _index : number;
    protected _builder : QueryBuilder | undefined;

    public constructor (index : number) {
        this._index = index;
        this._builder = undefined;
    }

    public setFormulaFromQueryBuilder (builder : QueryBuilder) {
        this._builder = builder;
    }

    public build (): [ string, any[] ] {
        return [ this.buildQueryString(), this.buildQueryValues() ];
    }

    public buildQueryString (): string {
        if (!this._builder) throw new TypeError(`Query builder not initialized`);
        return `${this._builder.buildQueryString()}->${this._index}`;
    }

    public buildQueryValues (): any[] {
        if (!this._builder) throw new TypeError(`Query builder not initialized`);
        return this._builder.buildQueryValues();
    }

    public getQueryValueFactories (): (() => any)[] {
        if (!this._builder) throw new TypeError(`Query builder not initialized`);
        return this._builder.getQueryValueFactories();
    }

    public static create (
        builder: QueryBuilder,
        index: number
    ) : PgJsonIndexBuilder {
        const f = new PgJsonIndexBuilder(index);
        f.setFormulaFromQueryBuilder(builder);
        return f;
    }

}
