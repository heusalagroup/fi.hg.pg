// Copyright (c) 2023. Heusala Group Oy <info@heusalagroup.fi>. All rights reserved.

import { QueryBuilder } from "../../../core/data/persisters/types/QueryBuilder";
import { map } from "../../../core/functions/map";
import { PgQueryUtils } from "../../utils/PgQueryUtils";

/**
 * This generates formulas like `table.column[, table2.column2, ...]`
 */
export class PgArgumentListBuilder implements QueryBuilder {

    private readonly _queryList : (() => string)[];
    private readonly _valueList : (() => any)[];

    public constructor () {
        this._queryList = [];
        this._valueList = [];
    }

    /**
     * Builds formula like `"table"."column"`.
     *
     * @param tableName The table name from where to read the value
     * @param columnName The column name in the table where to read the value
     */
    public setTableColumn (
        tableName: string,
        columnName: string
    ) {
        this._queryList.push( () => PgQueryUtils.quoteTableAndColumn(tableName, columnName) );
    }

    /**
     * Builds formula like `"table"."column"::text`.
     *
     * @param tableName The table name from where to read the value
     * @param columnName The column name in the table where to read the value
     */
    public setTableColumnAsText (
        tableName: string,
        columnName: string
    ) {
        this._queryList.push( () => `${PgQueryUtils.quoteTableAndColumn(tableName, columnName)}::text` );
    }

    /**
     * Builds query like `$1`
     *
     * @param value
     */
    public setParam (
        value: any
    ) {
        this._queryList.push( () => PgQueryUtils.getValuePlaceholder() );
        this._valueList.push( () => value );
    }

    /**
     * Builds query like `$1::text`
     *
     * @param value
     */
    public setParamAsText (
        value: any
    ) {
        this._queryList.push( () => `${PgQueryUtils.getValuePlaceholder()}::text` );
        this._valueList.push( () => value );
    }

    public setParamFactory (
        value: () => any
    ) {
        this._queryList.push( () => PgQueryUtils.getValuePlaceholder() );
        this._valueList.push( value );
    }

    public build () : [string, any[]] {
        return [this.buildQueryString(), this.buildQueryValues()];
    }

    public buildQueryString () : string {
        return map(this._queryList, (f) => f()).join(', ');
    }

    public buildQueryValues () : any[] {
        return map(this._valueList, (f) => f());
    }

    public getQueryValueFactories (): (() => any)[] {
        return this._valueList;
    }

}
