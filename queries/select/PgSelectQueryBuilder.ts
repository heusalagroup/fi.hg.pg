// Copyright (c) 2023. Heusala Group Oy <info@heusalagroup.fi>. All rights reserved.

import { QueryBuilder } from "../../../core/data/persisters/types/QueryBuilder";
import { SelectQueryBuilder } from "../../../core/data/persisters/types/SelectQueryBuilder";
import { forEach } from "../../../core/functions/forEach";
import { PgQueryUtils } from "../../utils/PgQueryUtils";
import { map } from "../../../core/functions/map";
import { Sort } from "../../../core/data/Sort";
import { SortOrder } from "../../../core/data/types/SortOrder";
import { EntityUtils } from "../../../core/data/utils/EntityUtils";
import { EntityField } from "../../../core/data/types/EntityField";
import { SortDirection } from "../../../core/data/types/SortDirection";

export class PgSelectQueryBuilder implements SelectQueryBuilder {

    private _mainIdColumnName : string | undefined;
    private _mainTableName : string | undefined;
    private _tablePrefix : string = '';
    private readonly _fieldQueries : (() => string)[];
    private readonly _fieldValues : (() => any)[];
    private readonly _leftJoinQueries : (() => string)[];
    private readonly _leftJoinValues : (() => any)[];
    private _where : QueryBuilder | undefined;
    private _orderBy : (() => string)[];

    public constructor () {
        this._mainIdColumnName = undefined;
        this._mainTableName = undefined;
        this._where = undefined;
        this._tablePrefix = '';
        this._fieldQueries = [];
        this._fieldValues = [];
        this._leftJoinQueries = [];
        this._leftJoinValues = [];
        this._orderBy = [];
    }

    public setTablePrefix (prefix: string) {
        this._tablePrefix = prefix;
    }

    public getTablePrefix (): string {
        return this._tablePrefix;
    }

    public getCompleteTableName (tableName : string) : string {
        return `${this._tablePrefix}${tableName}`;
    }

    public setWhereFromQueryBuilder (builder: QueryBuilder): void {
        this._where = builder;
    }

    public includeAllColumnsFromTable (tableName: string) {
        this._fieldQueries.push(() => `${PgQueryUtils.quoteTableName(this.getCompleteTableName(tableName))}.*`);
    }

    public includeColumnFromQueryBuilder (
        builder: QueryBuilder,
        asColumnName: string
    ) {
        this._fieldQueries.push(() => {
            const query = builder.buildQueryString();
            if (!query) throw new TypeError(`Query builder failed to create query string`);
            return `${query} AS ${PgQueryUtils.quoteColumnName(asColumnName)}`;
        });
        forEach(
            builder.getQueryValueFactories(),
            (item) => {
                this._fieldValues.push(item);
            }
        );
    }

    public includeFormulaByString (
        formula: string,
        asColumnName: string
    ): void {
        if (!formula) {
            throw new TypeError(`includeFormulaByString: formula is required`);
        }
        if (!asColumnName) {
            throw new TypeError(`includeFormulaByString: column name is required`);
        }
        this._fieldQueries.push(() => `${formula} AS ${PgQueryUtils.quoteColumnName(asColumnName)}`);
    }

    public setFromTable (tableName: string) {
        this._mainTableName = tableName;
    }

    public getCompleteFromTable (): string {
        if (!this._mainTableName) throw new TypeError(`From table has not been initialized yet`);
        return this.getCompleteTableName(this._mainTableName);
    }

    public getShortFromTable (): string {
        if (!this._mainTableName) throw new TypeError(`From table has not been initialized yet`);
        return this._mainTableName;
    }

    public setGroupByColumn (columnName: string) {
        this._mainIdColumnName = columnName;
    }

    public setOrderByTableFields (
        sort      : Sort,
        tableName : string,
        fields    : readonly EntityField[]
    ) {
        const orders = sort.getSortOrders();
        this._orderBy = orders?.length ? [
            () => map(
                orders,
                (item: SortOrder) => `${
                    PgQueryUtils.quoteTableAndColumn(
                        this.getCompleteTableName(tableName),
                        EntityUtils.getColumnName(item.getProperty(), fields)
                    )
                }${item.getDirection() === SortDirection.ASC ? ' ASC' : ' DESC'}`
            ).join(', ')] : [];
    }

    public getGroupByColumn (): string {
        if (!this._mainIdColumnName) throw new TypeError(`Group by has not been initialized yet`);
        return this._mainIdColumnName;
    }

    public leftJoinTable (
        fromTableName : string,
        fromColumnName : string,
        sourceTableName : string,
        sourceColumnName : string
    ) {
        this._leftJoinQueries.push(() => `LEFT JOIN ${PgQueryUtils.quoteTableName(this.getCompleteTableName(fromTableName))} ON ${PgQueryUtils.quoteTableAndColumn(this.getCompleteTableName(sourceTableName), sourceColumnName)} = ${PgQueryUtils.quoteTableAndColumn(this.getCompleteTableName(fromTableName), fromColumnName)}`);
    }

    public build () : [string, any[]] {
        return [this.buildQueryString(), this.buildQueryValues()];
    }

    public buildQueryString () : string {
        const fieldQueries = map(this._fieldQueries, (f) => f());
        const leftJoinQueries = map(this._leftJoinQueries, (f) => f());
        const orderBys = map(this._orderBy, (f) => f());
        let query = `SELECT ${fieldQueries.join(', ')}`;
        if (this._mainTableName) {
            query += ` FROM ${PgQueryUtils.quoteTableName(this.getCompleteTableName(this._mainTableName))}`;
        }
        if (leftJoinQueries.length) {
            query += ` ${leftJoinQueries.join(' ')}`;
        }
        if (this._where) {
            query += ` WHERE ${this._where.buildQueryString()}`;
        }
        if ( this._mainIdColumnName ) {
            if (!this._mainTableName) throw new TypeError(`No table initialized`);
            query += ` GROUP BY ${PgQueryUtils.quoteTableAndColumn(this.getCompleteTableName(this._mainTableName), this._mainIdColumnName)}`;
        }
        if ( orderBys.length ) {
            query += ` ORDER BY ${ orderBys.join(', ') }`;
        }
        return query;
    }

    public buildQueryValues () : any[] {
        const fieldValues = map(this._fieldValues, (f) => f());
        const leftJoinValues = map(this._leftJoinValues, (f) => f());
        return [
            ...fieldValues,
            ...leftJoinValues,
            ...( this._where ? this._where.buildQueryValues() : [])
        ];
    }

    public getQueryValueFactories (): (() => any)[] {
        return [
            ...this._fieldValues,
            ...this._leftJoinValues,
            ...( this._where ? this._where.getQueryValueFactories() : [])
        ]
    }

}
