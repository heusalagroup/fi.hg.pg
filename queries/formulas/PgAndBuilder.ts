// Copyright (c) 2023. Heusala Group Oy <info@heusalagroup.fi>. All rights reserved.

import { QueryBuilder } from "../../../core/data/persisters/types/QueryBuilder";
import { map } from "../../../core/functions/map";
import { PgQueryUtils } from "../../utils/PgQueryUtils";
import { PgParameterListBuilder } from "./PgParameterListBuilder";
import { forEach } from "../../../core/functions/forEach";

/**
 * Generates formulas like `"table"."column" IN ($#)[ AND "table"."column" = $#`
 */
export class PgAndBuilder implements QueryBuilder {

    private _formulaQuery : (() => string)[];
    private _formulaValues : (() => any)[];

    constructor () {
        this._formulaQuery = [];
        this._formulaValues = [];
    }

    public setColumnInList (
        tableName : string,
        columnName : string,
        values : readonly any[]
    ) {
        const builder = new PgParameterListBuilder();
        builder.setParams(values);
        this._formulaQuery.push( () => `${PgQueryUtils.quoteTableAndColumn(tableName, columnName)} IN (${builder.buildQueryString()})` );
        forEach(
            builder.getQueryValueFactories(),
            (f) => this._formulaValues.push(f)
        );
    }

    public setColumnEquals (
        tableName : string,
        columnName : string,
        value : any
    ) {
        this._formulaQuery.push( () => `${PgQueryUtils.quoteTableAndColumn(tableName, columnName)} = ${PgQueryUtils.getValuePlaceholder()}` );
        this._formulaValues.push(() => value);
    }

    public build (): [ string, any[] ] {
        return [ this.buildQueryString(), this.buildQueryValues() ];
    }

    public buildQueryString (): string {
        const formulaQuery = map(this._formulaQuery, (f) => f());
        return formulaQuery.join(' AND ');
    }

    public buildQueryValues (): any[] {
        return map(this._formulaValues, (f) => f());
    }

    public getQueryValueFactories (): (() => any)[] {
        return this._formulaValues;
    }

}
